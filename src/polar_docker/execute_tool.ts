import errorFromPolar from '../polar_bridge/error_from_polar.js';
import type {PolarError} from '../typescript/index.js';
import type {DataFolder} from './data_folder.js';
import type {DockerToolName} from './docker_tool_names.js';
import addNode from './tools/add_node.js';
import closeChannel from './tools/close_channel.js';
import createInvoice from './tools/create_invoice.js';
import createNetwork from './tools/create_network.js';
import deleteNetwork from './tools/delete_network.js';
import depositFunds from './tools/deposit_funds.js';
import getBitcoinWalletInfo from './tools/get_bitcoin_wallet_info.js';
import getBlockchainInfo from './tools/get_blockchain_info.js';
import getDefaultNodeCommand from './tools/get_default_node_command.js';
import getNewBitcoinAddress from './tools/get_new_bitcoin_address.js';
import getNodeInfo from './tools/get_node_info.js';
import getWalletBalance from './tools/get_wallet_balance.js';
import listChannels from './tools/list_channels.js';
import listNetworks from './tools/list_networks.js';
import listNodeVersions from './tools/list_node_versions.js';
import mineBlocks from './tools/mine_blocks.js';
import openChannel from './tools/open_channel.js';
import payInvoice from './tools/pay_invoice.js';
import removeNode from './tools/remove_node.js';
import renameNetwork from './tools/rename_network.js';
import renameNode from './tools/rename_node.js';
import restartNode from './tools/restart_node.js';
import sendBitcoin from './tools/send_bitcoin.js';
import setAutoMineMode from './tools/set_auto_mine_mode.js';
import setLightningBackend from './tools/set_lightning_backend.js';
import startNetwork from './tools/start_network.js';
import startNode from './tools/start_node.js';
import stopNetwork from './tools/stop_network.js';
import stopNode from './tools/stop_node.js';
import updateNodeCommand from './tools/update_node_command.js';
import type {ToolArgs} from './tools/types.js';

type Tool = (args: ToolArgs<any>) => Promise<unknown>;

// A tool can reject with a PolarError tuple, with its own code and details
const isPolarError = (err: unknown): err is PolarError =>
  Array.isArray(err) &&
  typeof err[0] === 'number' &&
  typeof err[1] === 'string';

/** Polar Tools That the Docker Backend Supports */
export const dockerTools: {[name in DockerToolName]: Tool} = {
  add_node: addNode,
  close_channel: closeChannel,
  create_invoice: createInvoice,
  create_network: createNetwork,
  delete_network: deleteNetwork,
  deposit_funds: depositFunds,
  get_bitcoin_wallet_info: getBitcoinWalletInfo,
  get_blockchain_info: getBlockchainInfo,
  get_default_node_command: getDefaultNodeCommand,
  get_new_bitcoin_address: getNewBitcoinAddress,
  get_node_info: getNodeInfo,
  get_wallet_balance: getWalletBalance,
  list_channels: listChannels,
  list_networks: listNetworks,
  list_node_versions: listNodeVersions,
  mine_blocks: mineBlocks,
  open_channel: openChannel,
  pay_invoice: payInvoice,
  remove_node: removeNode,
  rename_network: renameNetwork,
  rename_node: renameNode,
  restart_node: restartNode,
  send_bitcoin: sendBitcoin,
  set_auto_mine_mode: setAutoMineMode,
  set_lightning_backend: setLightningBackend,
  start_network: startNetwork,
  start_node: startNode,
  stop_network: stopNetwork,
  stop_node: stopNode,
  update_node_command: updateNodeCommand,
};

/** Run a Polar tool on Docker

  The result and the rejection have the same shape as from the Polar bridge. A
  PolarError tuple from a tool passes through with no change. The other errors
  get a code from their message, as the bridge errors do.

  {
    args: <Tool Arguments Object>
    folder: <Data Folder Object>
    tool: <Tool Name String>
    [tools]: {<Tool Name String>: <Tool Function>} // Default: dockerTools
  }

  @returns via Promise
  <Tool Result Object>

  @rejects <PolarError>
*/
export default async (args: {
  args: object;
  folder: DataFolder;
  tool: string;
  tools?: {[name: string]: Tool};
}) => {
  const tools: {[name: string]: Tool} = args.tools || dockerTools;

  try {
    if (!Object.hasOwn(tools, args.tool)) {
      throw new Error(
        `Unknown tool: ${args.tool} (polarDocker does not support it yet)`,
      );
    }

    const result = await tools[args.tool]({
      args: args.args,
      folder: args.folder,
    });

    // Return plain JSON data, as the bridge does
    return JSON.parse(JSON.stringify(result)) as unknown;
  } catch (err) {
    if (isPolarError(err)) {
      throw err;
    }

    const message = err instanceof Error ? err.message : String(err);

    throw errorFromPolar({err: message, tool: args.tool});
  }
};
