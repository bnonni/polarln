import {homedir} from 'node:os';

import type {PolarDocker} from '../typescript/index.js';
import makePolarDocker from './make_polar_docker.js';

export type PolarDockerArgs = {
  /** Data Directory Path (default: $POLARLN_DATA_DIR or ~/.polarln) */
  dataDir?: string;
};

/** Get a Polar Docker backend object

  The backend runs the Polar tools on Docker, without the Polar app. It uses
  the Polar Docker images and the Polar v4.0.0 compose templates.

  The backend supports bitcoind and LND nodes and these tools:
  - Network tools: list_networks, create_network, start_network, stop_network,
    delete_network, and rename_network
  - Node tools: add_node, remove_node, start_node, stop_node, restart_node,
    rename_node, list_node_versions, get_default_node_command,
    update_node_command, and set_lightning_backend
  - Bitcoin tools: mine_blocks, get_blockchain_info, get_bitcoin_wallet_info,
    send_bitcoin, get_new_bitcoin_address, and set_auto_mine_mode
  - Lightning tools: open_channel, close_channel, list_channels, get_node_info,
    get_wallet_balance, deposit_funds, create_invoice, and pay_invoice

  {
    [dataDir]: <Data Directory Path String>
  }

  @returns
  {
    polar: <Polar Docker Backend Object>
  }
*/
export default (args: PolarDockerArgs = {}): {polar: PolarDocker} => {
  return makePolarDocker({
    dataDir: args.dataDir,
    env: process.env,
    home: homedir(),
  });
};
