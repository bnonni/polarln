import type {PolarTool} from '../polar_bridge/index.js';
import {commandName} from './names.js';
import {flagName} from './names.js';
import type {BackendName} from './select_backend.js';

type Property = {
  default?: unknown;
  description?: string;
  enum?: unknown[];
  items?: {properties?: object; required?: string[]};
  type?: string;
};
type Row = [string, string];

const globalRows: Row[] = [
  ['--help, -h', 'Show the help.'],
  [
    '--backend <name>',
    'Backend: bridge (the Polar app) or docker (no Polar app). ' +
      'Default: $POLARLN_BACKEND, else bridge.',
  ],
  [
    '--url <url>',
    'Bridge backend only. Polar bridge base URL ' +
      '(default: http://localhost:37373, or the port in $POLAR_MCP_PORT).',
  ],
  [
    '--data-dir <path>',
    'Docker backend only. Data directory ' +
      '(default: $POLARLN_DATA_DIR, else ~/.polarln).',
  ],
];
const intros: {[backend in BackendName]: string[]} = {
  bridge: ['Run a Polar bridge tool. The Polar desktop app must run.'],
  docker: [
    'Run a Polar tool on Docker, without the Polar app. Docker must run.',
    'The commands that list, start, stop, rename, or delete networks, and the',
    'commands that start or stop nodes, work with all Polar node kinds.',
    'The lightning commands support LND and litd nodes.',
    'The commands that create networks, or add, remove, rename, or change',
    'nodes, work only with bitcoind and LND nodes.',
  ],
};
const notSupported =
  'The docker backend does not support this command yet (error 501).';
const sentenceEnd = /[.!?]$/;
const sentenceStop = /\.(?:\s|$)/;

// Align rows in two columns
const columns = (rows: Row[]) => {
  const width = Math.max(...rows.map(([left]) => left.length));

  return rows
    .map(([left, right]) => `  ${left.padEnd(width)}  ${right}`.trimEnd())
    .join('\n');
};

// Add a period to a text that has no end mark
const sentence = (text: string) =>
  !text || sentenceEnd.test(text) ? text : `${text}.`;

// Get the keys of the objects in an array argument
const itemKeysOf = (property: Property) => {
  const keys = Object.keys(property.items?.properties || {});
  const required = property.items?.required || [];

  if (!keys.length) {
    return '';
  }

  const names = keys.map(key => {
    return required.includes(key) ? `${key} (required)` : key;
  });

  return `Item keys: ${names.join(', ')}.`;
};

// Get the help row of an argument
const flagRow = ([name, property]: [string, Property], required: string[]) => {
  const flag = `--${flagName(name)}`;
  const isBoolean = property.type === 'boolean';
  const isFalseByDefault = property.default === false;
  const isJson = property.type === 'array' || property.type === 'object';

  const value = isJson ? 'json' : property.type || 'value';

  const notes = [
    required.includes(name) ? '(required)' : '',
    sentence(property.description || ''),
    !!property.enum ? `Values: ${property.enum.join(', ')}.` : '',
    property.type === 'array' ? itemKeysOf(property) : '',
    isBoolean && !isFalseByDefault
      ? `Use --no-${flagName(name)} for false.`
      : '',
  ];

  const left = isBoolean ? flag : `${flag} <${value}>`;

  return [left, notes.filter(Boolean).join(' ')] satisfies Row;
};

// Get the command list rows of tools
const commandRows = (tools: PolarTool[]) => {
  return tools.map(({description, name}): Row => {
    return [commandName(name), description.split(sentenceStop)[0] || ''];
  });
};

/** Get the help text of a command

  {
    tool: <Polar Tool Object>
    unsupported: [<Tool Name That the Backend Does Not Support String>]
  }

  @returns
  <Help Text String>
*/
export const commandHelp = ({
  tool,
  unsupported,
}: {
  tool: PolarTool;
  unsupported: string[];
}) => {
  const required = tool.inputSchema.required || [];

  const entries = Object.entries(tool.inputSchema.properties) as [
    string,
    Property,
  ][];

  // Show the required flags first
  const sorted = [
    ...entries.filter(([name]) => required.includes(name)),
    ...entries.filter(([name]) => !required.includes(name)),
  ];

  const rows = sorted.map(entry => flagRow(entry, required));

  const notes = unsupported.includes(tool.name) ? [notSupported, ''] : [];

  return [
    `Usage: polarln ${commandName(tool.name)} [flags]`,
    '',
    tool.description,
    '',
    ...notes,
    'Flags:',
    columns([...rows, ...globalRows]),
    '',
  ].join('\n');
};

/** Get the help text of all commands

  The tools that the backend does not support show in a separate list

  {
    backend: <Backend Name String>
    tools: [<Polar Tool Object>]
    unsupported: [<Tool Name That the Backend Does Not Support String>]
  }

  @returns
  <Help Text String>
*/
export const commandsHelp = ({
  backend,
  tools,
  unsupported,
}: {
  backend: BackendName;
  tools: PolarTool[];
  unsupported: string[];
}) => {
  const isSupported = (tool: PolarTool) => !unsupported.includes(tool.name);

  const others = tools.filter(tool => !isSupported(tool));

  const otherLines = !others.length
    ? []
    : [
        `Commands that the ${backend} backend does not support yet (error 501):`,
        columns(commandRows(others)),
        '',
      ];

  return [
    'Usage: polarln <command> [flags]',
    '',
    ...intros[backend],
    '',
    'Commands:',
    columns(commandRows(tools.filter(isSupported))),
    '',
    ...otherLines,
    'Flags for all commands:',
    columns(globalRows),
    '',
    'Put the flags after the command: polarln list-networks --backend docker',
    'Run "polarln <command> --help" to see the flags of a command.',
    'Run "polarln --version" to see the version.',
    '',
  ].join('\n');
};
