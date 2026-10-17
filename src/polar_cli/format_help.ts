import type {PolarTool} from '../polar_bridge/index.js';
import {commandName} from './names.js';
import {flagName} from './names.js';

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
  ['--url <url>', 'Polar bridge base URL (default: http://localhost:37373).'],
];
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

/** Get the help text of a command

  <Polar Tool Object>

  @returns
  <Help Text String>
*/
export const commandHelp = (tool: PolarTool) => {
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

  return [
    `Usage: polarln ${commandName(tool.name)} [flags]`,
    '',
    tool.description,
    '',
    'Flags:',
    columns([...rows, ...globalRows]),
    '',
  ].join('\n');
};

/** Get the help text of all commands

  [<Polar Tool Object>]

  @returns
  <Help Text String>
*/
export const commandsHelp = (tools: PolarTool[]) => {
  const rows = tools.map(({description, name}): Row => {
    return [commandName(name), description.split(sentenceStop)[0] || ''];
  });

  return [
    'Usage: polarln <command> [flags]',
    '',
    'Run a Polar bridge tool. The Polar desktop app must run.',
    '',
    'Commands:',
    columns(rows),
    '',
    'Flags for all commands:',
    columns(globalRows),
    '',
    'Run "polarln <command> --help" to see the flags of a command.',
    'Run "polarln --version" to see the version.',
    '',
  ].join('\n');
};
