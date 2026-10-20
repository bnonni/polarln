// Bridge port rule from jamaljsr/polar (MIT): electron/constants.ts (MCP_PORT).

import findPolarProcess from './find_polar_process.js';
import type {PolarProcessScan} from './find_polar_process.js';
import probeBridge from './probe_bridge.js';

/** Result of the Polar App Check */
export type PolarAppCheck =
  | {found: 'bridge'; runs: true; url: string}
  | {found: 'process'; pid: number; runs: true}
  | {runs: false};

/** Arguments of the Polar App Check */
export type CheckPolarAppArgs = {
  /** Environment Variables (POLAR_MCP_PORT) */
  env: NodeJS.ProcessEnv;
  /** Fetch Function (default: global fetch) */
  fetch?: typeof fetch;
  /** Look for a Polar Process (default: the scan of the processes) */
  findProcess?: () => Promise<PolarProcessScan>;
  /** Maximum Milliseconds for the Bridge Probe (default: 1500) */
  timeout?: number;
};

const defaultPort = 37373;

/** Check if the Polar app runs

  The check first probes the Polar bridge at localhost, on the port of
  POLAR_MCP_PORT, else on port 37373. If the bridge answers, the app runs.

  The app can run without the bridge: a different program can use the port,
  the app can use a different POLAR_MCP_PORT, or the bridge does not listen
  yet. Thus, after a refused connect, the check looks for a Polar process.

  The check fails closed. If the probe or the scan gives no clear result, the
  method rejects.

  {
    env: <Environment Variables Object>
    [fetch]: <Fetch Function>
    [findProcess]: <Look for a Polar Process Function>
    [timeout]: <Maximum Bridge Probe Milliseconds Number> // Default: 1500
  }

  @rejects
  <Error>

  @returns via Promise
  {
    [found]: <The App Was Found By String> // bridge or process
    [pid]: <Polar Process Id Number> // Only if found is process
    runs: <The Polar App Runs Bool>
    [url]: <Bridge URL String> // Only if found is bridge
  }
*/
export default async (args: CheckPolarAppArgs): Promise<PolarAppCheck> => {
  const url = `http://localhost:${args.env.POLAR_MCP_PORT || defaultPort}`;

  const probe = await probeBridge({
    fetch: args.fetch,
    timeout: args.timeout,
    url,
  });

  if (probe.result === 'answers') {
    return {found: 'bridge', runs: true, url};
  }

  if (probe.result === 'unknown') {
    throw new Error(`The Polar bridge check at ${url} gave no clear result`, {
      cause: probe.err,
    });
  }

  const scan = await (args.findProcess || findPolarProcess)();

  if (scan.result === 'unknown') {
    throw new Error('The Polar process check gave no clear result', {
      cause: scan.err,
    });
  }

  if (scan.result === 'found') {
    return {found: 'process', pid: scan.pid, runs: true};
  }

  return {runs: false};
};
