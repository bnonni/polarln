import {homedir} from 'node:os';
import {join} from 'node:path';
import {resolve} from 'node:path';

import type {PolarDocker} from '../typescript/index.js';
import executeTool from './execute_tool.js';

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

  {
    [dataDir]: <Data Directory Path String>
  }

  @returns
  {
    polar: <Polar Docker Backend Object>
  }
*/
export default (args: PolarDockerArgs = {}): {polar: PolarDocker} => {
  const dir =
    args.dataDir || process.env.POLARLN_DATA_DIR || join(homedir(), '.polarln');

  const dataDir = resolve(dir);

  return {
    polar: {
      dataDir,
      execute: (tool, toolArgs) => executeTool({args: toolArgs, dataDir, tool}),
    },
  };
};
