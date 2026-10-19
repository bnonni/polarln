import errorFromPolar from '../polar_bridge/error_from_polar.js';
import createNetwork from './tools/create_network.js';
import deleteNetwork from './tools/delete_network.js';
import listNetworks from './tools/list_networks.js';
import renameNetwork from './tools/rename_network.js';
import startNetwork from './tools/start_network.js';
import stopNetwork from './tools/stop_network.js';
import type {ToolArgs} from './tools/types.js';

type Tool = (args: ToolArgs<any>) => Promise<unknown>;

/** Polar Tools That the Docker Backend Supports */
export const dockerTools: {[name: string]: Tool} = {
  create_network: createNetwork,
  delete_network: deleteNetwork,
  list_networks: listNetworks,
  rename_network: renameNetwork,
  start_network: startNetwork,
  stop_network: stopNetwork,
};

/** Run a Polar tool on Docker

  The result and the rejection have the same shape as from the Polar bridge

  {
    args: <Tool Arguments Object>
    dataDir: <Data Directory Path String>
    tool: <Tool Name String>
  }

  @returns via Promise
  <Tool Result Object>

  @rejects <PolarError>
*/
export default async (args: {args: object; dataDir: string; tool: string}) => {
  try {
    if (!Object.hasOwn(dockerTools, args.tool)) {
      throw new Error(
        `Unknown tool: ${args.tool} (polarDocker does not support it yet)`,
      );
    }

    const result = await dockerTools[args.tool]({
      args: args.args,
      dataDir: args.dataDir,
    });

    // Return plain JSON data, as the bridge does
    return JSON.parse(JSON.stringify(result)) as unknown;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    throw errorFromPolar({err: message, tool: args.tool});
  }
};
