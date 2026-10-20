import type {PolarProcessScan} from '../polar_app/find_polar_process.js';
import isConnectionRefused from '../polar_app/is_connection_refused.js';
import {listTools} from '../polar_bridge/index.js';
import type {PolarTool} from '../polar_bridge/index.js';
import type {Polar} from '../typescript/index.js';
import type {PolarError} from '../typescript/index.js';
import type {SelectBackendResult} from './select_backend.js';

/** Backend That Runs a Command */
export type ResolvedBackend =
  | {auto: boolean; backend: 'bridge'; tools: PolarTool[]}
  | {auto: boolean; backend: 'docker'; scan?: 'none' | 'unknown'};

const appRunsWithoutBridgeHint =
  'The Polar app runs, but its bridge does not answer at the url. Set ' +
  'POLAR_MCP_PORT, or use --url, with the bridge port of the app. To use ' +
  'Docker, quit the app.';

// Maximum milliseconds for the tools request of the bridge
const toolsTimeout = 3000;

// A refused connect shows that no program listens at the bridge URL
const isBridgeRefused = (err: unknown) => {
  if (!Array.isArray(err) || err[1] !== 'FailedToConnectToPolarBridge') {
    return false;
  }

  return isConnectionRefused((err[2] as {err?: unknown} | undefined)?.err);
};

// The CLI uses the name, the description, and the argument properties of a
// tool. A different server can answer with a body that has none of them.
const isTool = (n: unknown): n is PolarTool => {
  const tool = n as Partial<PolarTool> | null;

  return (
    !!tool &&
    typeof tool.name === 'string' &&
    typeof tool.description === 'string' &&
    !!tool.inputSchema?.properties &&
    typeof tool.inputSchema.properties === 'object'
  );
};

/** Resolve the backend of a command

  The bridge backend gets the tools from the Polar bridge, with a timeout of
  3 s. An answer without a list of Polar tools rejects with 503
  UnexpectedPolarBridgeResponse. The docker backend needs no request.

  Under auto, the tools request of the bridge comes first:
  - An answer selects the bridge.
  - A refused connect starts a scan for a Polar process. If a Polar process
    runs, the method rejects with 409 PolarAppRunsWithoutBridge. Else, also
    if the scan has no clear result, docker runs. The docker backend checks
    the Polar app again before each change to the Polar files.
  - Each other failure rejects: a timeout, an error answer, a different
    server, or a bad URL. Such a failure does not prove that the app is off.

  Use a bridge URL with localhost or an IP address: in bun, a host name that
  does not resolve also gives a refused connect.

  {
    bridge: <Polar Bridge Object>
    findProcess: <Look for a Polar Process Function>
    selected: {
      backend: <Backend Choice String> // auto, bridge, or docker
      from: <Backend Source String>
    }
  }

  @rejects <PolarError>

  @returns via Promise
  {
    auto: <The Backend Comes From the Bridge Probe Bool>
    backend: <Backend Name String> // bridge or docker
    [scan]: <Process Scan Result String> // none or unknown, only for docker
    [tools]: [<Polar Tool Object>] // Only for the bridge
  }
*/
export default async (args: {
  bridge: Polar;
  findProcess: () => Promise<PolarProcessScan>;
  selected: SelectBackendResult;
}): Promise<ResolvedBackend> => {
  const auto = args.selected.backend === 'auto';

  if (args.selected.backend === 'docker') {
    return {auto, backend: 'docker'};
  }

  try {
    const answer: unknown = await listTools({
      polar: args.bridge,
      timeout: toolsTimeout,
    });

    const tools = (answer as {tools?: unknown} | null)?.tools;

    if (!Array.isArray(tools) || !tools.every(isTool)) {
      throw [
        503,
        'UnexpectedPolarBridgeResponse',
        {err: 'ExpectedArrayOfPolarTools', url: args.bridge.url},
      ] satisfies PolarError;
    }

    return {auto, backend: 'bridge', tools};
  } catch (err) {
    // Only a refused connect under auto can select docker
    if (!auto || !isBridgeRefused(err)) {
      throw err;
    }
  }

  const scan = await args.findProcess();

  if (scan.result === 'found') {
    throw [
      409,
      'PolarAppRunsWithoutBridge',
      {hint: appRunsWithoutBridgeHint, pid: scan.pid, url: args.bridge.url},
    ] satisfies PolarError;
  }

  return {auto, backend: 'docker', scan: scan.result};
};
