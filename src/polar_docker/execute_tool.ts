import errorFromPolar from '../polar_bridge/error_from_polar.js';
import addNode from './tools/add_node.js';
import createNetwork from './tools/create_network.js';
import deleteNetwork from './tools/delete_network.js';
import getDefaultNodeCommand from './tools/get_default_node_command.js';
import listNetworks from './tools/list_networks.js';
import listNodeVersions from './tools/list_node_versions.js';
import removeNode from './tools/remove_node.js';
import renameNetwork from './tools/rename_network.js';
import renameNode from './tools/rename_node.js';
import restartNode from './tools/restart_node.js';
import setLightningBackend from './tools/set_lightning_backend.js';
import startNetwork from './tools/start_network.js';
import startNode from './tools/start_node.js';
import stopNetwork from './tools/stop_network.js';
import stopNode from './tools/stop_node.js';
import updateNodeCommand from './tools/update_node_command.js';
import type {ToolArgs} from './tools/types.js';

type Tool = (args: ToolArgs<any>) => Promise<unknown>;

/** Polar Tools That the Docker Backend Supports */
export const dockerTools: {[name: string]: Tool} = {
  add_node: addNode,
  create_network: createNetwork,
  delete_network: deleteNetwork,
  get_default_node_command: getDefaultNodeCommand,
  list_networks: listNetworks,
  list_node_versions: listNodeVersions,
  remove_node: removeNode,
  rename_network: renameNetwork,
  rename_node: renameNode,
  restart_node: restartNode,
  set_lightning_backend: setLightningBackend,
  start_network: startNetwork,
  start_node: startNode,
  stop_network: stopNetwork,
  stop_node: stopNode,
  update_node_command: updateNodeCommand,
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
