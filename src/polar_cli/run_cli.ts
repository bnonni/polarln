import {parseArgs} from 'node:util';
import type {ParseArgsOptionsConfig} from 'node:util';

import {listTools} from '../polar_bridge/index.js';
import {polarBridge} from '../polar_bridge/index.js';
import {toolMethod} from '../polar_bridge/index.js';
import type {PolarTool} from '../polar_bridge/index.js';
import {dockerToolNames} from '../polar_docker/docker_tool_names.js';
import type {PolarDockerArgs} from '../polar_docker/index.js';
import type {PolarBackend} from '../typescript/index.js';
import type {PolarDocker} from '../typescript/index.js';
import type {PolarError} from '../typescript/index.js';
import bundledTools from './bundled_tools.js';
import formatError from './format_error.js';
import {commandHelp} from './format_help.js';
import {commandsHelp} from './format_help.js';
import localTools from './local_tools.js';
import {commandName} from './names.js';
import parseFlags from './parse_flags.js';
import {globalOptions} from './parse_flags.js';
import type {ParseFlagsResult} from './parse_flags.js';
import selectBackend from './select_backend.js';
import type {SelectBackendResult} from './select_backend.js';

const dockerNames: readonly string[] = dockerToolNames;
const failed = 1;
const helpCommands = ['--help', '-h', 'help'];
const isFlag = (arg: string) => arg.startsWith('-');
const localNames = localTools.map(({name}) => name);
const stringOf = (n: unknown) => (typeof n === 'string' && !!n ? n : undefined);
const succeeded = 0;
const usageFailed = 2;
const versionCommands = ['--version', '-v'];

// Tools of the bundled schemas that the docker backend does not support
const dockerUnsupported = bundledTools
  .map(({name}) => name)
  .filter(name => !dockerNames.includes(name));

export type RunCliArgs = {
  /** Command Line Arguments Without the Node and Script Paths */
  argv: string[];
  /** Environment Variables With POLARLN_BACKEND and POLARLN_DATA_DIR
    (default: process.env) */
  env?: {[name: string]: string | undefined};
  /** Fetch Function (default: global fetch) */
  fetch?: typeof fetch;
  /** Make the Docker Backend (default: polarDocker) */
  polarDocker?: (args: PolarDockerArgs) => {polar: PolarDocker};
  /** Write Error Output */
  stderr: (text: string) => void;
  /** Write Output */
  stdout: (text: string) => void;
  /** Package Version */
  version: string;
};

// Get the global flags and the positionals before the command flags are known
const preParse = (argv: string[]) => {
  const options: ParseArgsOptionsConfig = globalOptions;

  const {positionals, tokens, values} = parseArgs({
    allowPositionals: true,
    args: argv,
    options,
    strict: false,
    tokens: true,
  });

  // Without strict mode, a global flag with no value takes the next flag
  const taken = tokens.find(token => {
    return (
      token.kind === 'option' &&
      options[token.name]?.type === 'string' &&
      !token.inlineValue &&
      !!token.value?.startsWith('-')
    );
  });

  if (taken?.kind === 'option') {
    const details = {flag: taken.rawName, value: taken.value};

    throw [400, 'InvalidFlags', details] satisfies PolarError;
  }

  return {positionals, values: values as {[flag: string]: boolean | string}};
};

// Make the Docker backend. Load its code only here: grpc-js adds about 130 ms.
const dockerOf = async (args: {
  dataDir?: string;
  make?: RunCliArgs['polarDocker'];
}) => {
  try {
    const make =
      args.make || (await import('../polar_docker/index.js')).polarDocker;

    return make({dataDir: args.dataDir}).polar;
  } catch (err) {
    throw [503, 'FailedToLoadDockerBackend', {err}] satisfies PolarError;
  }
};

// Run a tool with its arguments
const runTool = (args: {
  args: {[name: string]: unknown};
  polar: PolarBackend;
  tool: PolarTool;
}) => {
  const local = localTools.find(({name}) => name === args.tool.name);

  const method = local?.method || toolMethod<object, unknown>(args.tool.name);

  return method({...args.args, polar: args.polar});
};

/** Run the polarln command line

  Each Polar tool is a command: open_channel is `polarln open-channel`

  Each tool argument is a flag: networkId is `--network-id`

  The bridge backend gets the tools from the Polar app. The docker backend
  uses the bundled tool schemas, so its help does not need Docker.

  The result goes to the output as JSON. A rejection goes to the error output
  as one line of JSON: [code, message, details]

  {
    argv: [<Command Line Argument String>]
    [env]: {<Environment Variable Name String>: <Value String>}
    [fetch]: <Fetch Function>
    [polarDocker]: <Make Docker Backend Function>
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

  const env = args.env || process.env;

  let positionals: string[];
  let selected: SelectBackendResult;
  let values: {[flag: string]: boolean | string};

  try {
    ({positionals, values} = preParse(argv));

    selected = selectBackend({env, values});
  } catch (err) {
    args.stderr(formatError(err));

    return usageFailed;
  }

  const {backend} = selected;

  const bridge =
    backend !== 'bridge'
      ? undefined
      : polarBridge({fetch: args.fetch, url: stringOf(values.url)}).polar;

  const unsupported = !bridge ? dockerUnsupported : [];

  let tools: PolarTool[];

  try {
    const source = !bridge
      ? bundledTools
      : (await listTools({polar: bridge})).tools;

    tools = [
      ...source.filter(({name}) => !localNames.includes(name)),
      ...localTools,
    ];
  } catch (err) {
    args.stderr(formatError(err));

    return failed;
  }

  const name = isHelp ? positionals[0] : command;

  if (!name) {
    args.stdout(commandsHelp({backend, tools, unsupported}));

    return succeeded;
  }

  const tool = tools.find(tool => commandName(tool.name) === name);

  if (!tool) {
    args.stderr(formatError([400, 'UnknownCommand', {command: name}]));

    return usageFailed;
  }

  if (isHelp) {
    args.stdout(commandHelp({tool, unsupported}));

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
    args.stdout(commandHelp({tool, unsupported}));

    return succeeded;
  }

  try {
    const polar =
      bridge ||
      (await dockerOf({
        dataDir: stringOf(values['data-dir']) || stringOf(env.POLARLN_DATA_DIR),
        make: args.polarDocker,
      }));

    const result = await runTool({args: flags.args, polar, tool});

    args.stdout(`${JSON.stringify(result, null, 2)}\n`);

    return succeeded;
  } catch (err) {
    args.stderr(formatError(err));

    return failed;
  }
};
