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

  In a data directory of the Polar app (~/.local/share/polar or ~/.polar),
  the containers are polar-n<id>-<name> and the compose projects are
  polar-network-<id>, as in the Polar app. In a different data directory, the
  names start with polarln.

  The Polar app does not read its files again while it runs. Thus, in a data
  directory of the Polar app, each tool that can change files or containers
  first checks that the app does not run. The check probes the Polar bridge
  on the port of POLAR_MCP_PORT, else on port 37373, and then looks for a
  Polar process. If the app runs, the tool gives 409 PolarAppIsRunning. If
  the check has no clear result, the tool gives 503 FailedToCheckPolarApp.

  As in Polar, a start uses the compose file of the network, and a stop runs
  docker compose down. A start writes a new compose file only if the file is
  not there or a port moves. Thus a network with tapd, litd, c-lightning, or
  eclair nodes, or with a service that a user added, can start and stop. The
  tools that change the nodes need a network with only bitcoind and LND
  nodes, and a compose file with no other services. A container of a
  different folder with a container name or the compose project of the
  network gives 409 ContainerNameInUse.

  The Lightning tools also work on litd nodes, with the integrated lnd
  daemon, as in Polar.

  The backend makes only bitcoind and LND nodes. It has these tools:
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
