import {parseArgs} from 'node:util';

import {listTools} from '../polar_bridge/index.js';
import {polarBridge} from '../polar_bridge/index.js';
import {toolMethod} from '../polar_bridge/index.js';
import type {PolarTool} from '../polar_bridge/index.js';
import type {Polar} from '../typescript/index.js';
import formatError from './format_error.js';
import {commandHelp} from './format_help.js';
import {commandsHelp} from './format_help.js';
import localTools from './local_tools.js';
import {commandName} from './names.js';
import parseFlags from './parse_flags.js';
import {globalOptions} from './parse_flags.js';
import type {ParseFlagsResult} from './parse_flags.js';

const failed = 1;
const helpCommands = ['--help', '-h', 'help'];
const isFlag = (arg: string) => arg.startsWith('-');
const localNames = localTools.map(({name}) => name);
const succeeded = 0;
const usageFailed = 2;
const versionCommands = ['--version', '-v'];

export type RunCliArgs = {
  /** Command Line Arguments Without the Node and Script Paths */
  argv: string[];
  /** Fetch Function (default: global fetch) */
  fetch?: typeof fetch;
  /** Write Error Output */
  stderr: (text: string) => void;
  /** Write Output */
  stdout: (text: string) => void;
  /** Package Version */
  version: string;
};

// Get the bridge URL and the positionals before the command flags are known
const preParse = (argv: string[]) => {
  const {positionals, values} = parseArgs({
    allowPositionals: true,
    args: argv,
    options: globalOptions,
    strict: false,
  });

  const url = typeof values.url === 'string' ? values.url : undefined;

  return {positionals, url};
};

// Run a tool with its arguments
const runTool = (args: {
  args: {[name: string]: unknown};
  polar: Polar;
  tool: PolarTool;
}) => {
  const local = localTools.find(({name}) => name === args.tool.name);

  const method = local?.method || toolMethod<object, unknown>(args.tool.name);

  return method({...args.args, polar: args.polar});
};

/** Run the polarln command line

  Each Polar bridge tool is a command: open_channel is `polarln open-channel`

  Each tool argument is a flag: networkId is `--network-id`

  The result goes to the output as JSON. A rejection goes to the error output
  as one line of JSON: [code, message, details]

  {
    argv: [<Command Line Argument String>]
    [fetch]: <Fetch Function>
    stderr: <Write Error Output Function>
    stdout: <Write Output Function>
    version: <Package Version String>
  }

  @returns via Promise
  <Exit Code Number> // 0: success, 1: failure, 2: usage error
*/
export default async (args: RunCliArgs): Promise<number> => {
  const [command = 'help', ...argv] = args.argv;

  if (versionCommands.includes(command)) {
    args.stdout(`${args.version}\n`);

    return succeeded;
  }

  const isHelp = helpCommands.includes(command);

  if (!isHelp && isFlag(command)) {
    args.stderr(formatError([400, 'ExpectedCommandBeforeFlags', {command}]));

    return usageFailed;
  }

  const {positionals, url} = preParse(argv);

  const {polar} = polarBridge({fetch: args.fetch, url});

  let tools: PolarTool[];

  try {
    const live = await listTools({polar});

    tools = [
      ...live.tools.filter(({name}) => !localNames.includes(name)),
      ...localTools,
    ];
  } catch (err) {
    args.stderr(formatError(err));

    return failed;
  }

  const name = isHelp ? positionals[0] : command;

  if (!name) {
    args.stdout(commandsHelp(tools));

    return succeeded;
  }

  const tool = tools.find(tool => commandName(tool.name) === name);

  if (!tool) {
    args.stderr(formatError([400, 'UnknownCommand', {command: name}]));

    return usageFailed;
  }

  if (isHelp) {
    args.stdout(commandHelp(tool));

    return succeeded;
  }

  let flags: ParseFlagsResult;

  try {
    flags = parseFlags({argv, tool});
  } catch (err) {
    args.stderr(formatError(err));

    return usageFailed;
  }

  if (flags.help) {
    args.stdout(commandHelp(tool));

    return succeeded;
  }

  try {
    const result = await runTool({args: flags.args, polar, tool});

    args.stdout(`${JSON.stringify(result, null, 2)}\n`);

    return succeeded;
  } catch (err) {
    args.stderr(formatError(err));

    return failed;
  }
};
