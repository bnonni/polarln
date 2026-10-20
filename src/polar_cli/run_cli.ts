import {homedir} from 'node:os';
import {resolve} from 'node:path';
import {parseArgs} from 'node:util';
import type {ParseArgsOptionsConfig} from 'node:util';

import findPolarProcess from '../polar_app/find_polar_process.js';
import type {PolarProcessScan} from '../polar_app/find_polar_process.js';
import {isPolarHome} from '../polar_app/polar_home.js';
import {polarHome} from '../polar_app/polar_home.js';
import {polarBridge} from '../polar_bridge/index.js';
import {toolMethod} from '../polar_bridge/index.js';
import type {PolarTool} from '../polar_bridge/index.js';
import type {CheckApp} from '../polar_docker/data_folder.js';
import {dockerToolNames} from '../polar_docker/docker_tool_names.js';
import type {PolarBackend} from '../typescript/index.js';
import type {PolarDocker} from '../typescript/index.js';
import type {PolarError} from '../typescript/index.js';
import bundledTools from './bundled_tools.js';
import formatError from './format_error.js';
import {commandHelp} from './format_help.js';
import {commandsHelp} from './format_help.js';
import type {HelpBackend} from './format_help.js';
import localTools from './local_tools.js';
import {commandName} from './names.js';
import parseFlags from './parse_flags.js';
import {globalOptions} from './parse_flags.js';
import type {ParseFlagsResult} from './parse_flags.js';
import resolveBackend from './resolve_backend.js';
import type {ResolvedBackend} from './resolve_backend.js';
import selectBackend from './select_backend.js';
import type {SelectBackendResult} from './select_backend.js';

const defaultBridgePort = 37373;
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

/** Arguments of the Docker Backend Maker of the CLI */
export type DockerMakerArgs = {
  /** Resolved Data Directory Path */
  dataDir: string;
  /** Home Directory Path */
  home: string;
};

export type RunCliArgs = {
  /** Command Line Arguments Without the Node and Script Paths */
  argv: string[];
  /** Check if the Polar App Runs, for the Docker Guard (tests give a fake) */
  checkApp?: CheckApp;
  /** Environment Variables With POLARLN_BACKEND, POLARLN_DATA_DIR, and
    POLAR_MCP_PORT (default: process.env) */
  env?: {[name: string]: string | undefined};
  /** Fetch Function (default: global fetch) */
  fetch?: typeof fetch;
  /** Look for a Polar Process (default: the scan of the processes) */
  findProcess?: () => Promise<PolarProcessScan>;
  /** Home Directory Path (default: the home directory of the user) */
  home?: string;
  /** Make the Docker Backend (default: the internal polarDocker maker) */
  polarDocker?: (args: DockerMakerArgs) => {polar: PolarDocker};
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
  checkApp?: CheckApp;
  dataDir: string;
  env: {[name: string]: string | undefined};
  home: string;
  make?: RunCliArgs['polarDocker'];
}) => {
  try {
    if (!!args.make) {
      return args.make({dataDir: args.dataDir, home: args.home}).polar;
    }

    const {default: make} =
      await import('../polar_docker/make_polar_docker.js');

    const {polar} = make({
      checkApp: args.checkApp,
      dataDir: args.dataDir,
      env: args.env,
      home: args.home,
    });

    return polar;
  } catch (err) {
    throw [503, 'FailedToLoadDockerBackend', {err}] satisfies PolarError;
  }
};

// Get the backend line data of the help
const helpBackendOf = (args: {
  dataDir: string;
  home: string;
  resolved: ResolvedBackend;
  selected: SelectBackendResult;
  url: string;
}): HelpBackend => {
  const {auto, backend} = args.resolved;
  const {from} = args.selected;

  if (backend === 'bridge') {
    return {auto, backend, from, url: args.url};
  }

  return {
    auto,
    backend,
    dataDir: args.dataDir,
    from,
    isPolarHome: isPolarHome({dataDir: args.dataDir, home: args.home}),
    scan: args.resolved.scan,
    url: args.url,
  };
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

  The backend is the --backend flag, then POLARLN_BACKEND, then auto. Under
  auto, these rules select the backend:
  - A --url flag selects the bridge, with no fallback.
  - A --data-dir flag selects docker, with no bridge request.
  - A --url or --data-dir flag with an empty value or with no value is the
    same as no flag.
  - With neither flag, the CLI requests the tools of the bridge. An answer
    selects the bridge. A refused connect starts a scan for a Polar process.
    If a Polar process runs, the command fails with 409
    PolarAppRunsWithoutBridge. Else docker runs.
  - Each other failure of the request fails the command, because it does not
    prove that the app is off: a timeout, an error answer, or a bad URL.

  The bridge URL is the --url flag, else localhost on the port of
  POLAR_MCP_PORT, else on port 37373. The tools request has a timeout of
  3 s. The bridge backend gets the tools from the Polar app. The docker
  backend uses the bundled tool schemas, so its help does not need Docker.

  The docker data directory is the --data-dir flag, then POLARLN_DATA_DIR,
  then the Polar home: <home>/.local/share/polar if it exists, else
  <home>/.polar. In the Polar home, the docker backend checks that the Polar
  app does not run before each change.

  The help names the backend and the cause of the choice. The result goes
  to the output as JSON. A rejection goes to the error output as one line of
  JSON: [code, message, details]

  {
    argv: [<Command Line Argument String>]
    [checkApp]: <Check if the Polar App Runs Function>
    [env]: {<Environment Variable Name String>: <Value String>}
    [fetch]: <Fetch Function>
    [findProcess]: <Look for a Polar Process Function>
    [home]: <Home Directory Path String> // Default: os.homedir()
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
  const home = args.home ?? homedir();

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

  const {polar: bridge} = polarBridge({
    fetch: args.fetch,
    url:
      stringOf(values.url) ||
      `http://localhost:${env.POLAR_MCP_PORT || defaultBridgePort}`,
  });

  let resolved: ResolvedBackend;

  try {
    resolved = await resolveBackend({
      bridge,
      findProcess: args.findProcess || findPolarProcess,
      selected,
    });
  } catch (err) {
    args.stderr(formatError(err));

    return failed;
  }

  const source = resolved.backend === 'bridge' ? resolved.tools : bundledTools;

  const tools = [
    ...source.filter(({name}) => !localNames.includes(name)),
    ...localTools,
  ];

  const unsupported = resolved.backend === 'docker' ? dockerUnsupported : [];

  const dataDir = resolve(
    stringOf(values['data-dir']) ||
      stringOf(env.POLARLN_DATA_DIR) ||
      polarHome({home}),
  );

  const name = isHelp ? positionals[0] : command;

  if (!name) {
    const backend = helpBackendOf({
      dataDir,
      home,
      resolved,
      selected,
      url: bridge.url,
    });

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
      resolved.backend === 'bridge'
        ? bridge
        : await dockerOf({
            checkApp: args.checkApp,
            dataDir,
            env,
            home,
            make: args.polarDocker,
          });

    const result = await runTool({args: flags.args, polar, tool});

    args.stdout(`${JSON.stringify(result, null, 2)}\n`);

    return succeeded;
  } catch (err) {
    args.stderr(formatError(err));

    return failed;
  }
};
