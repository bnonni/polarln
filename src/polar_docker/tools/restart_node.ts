// Ported from jamaljsr/polar (MIT): src/store/models/mcp/network/restartNode.ts.

import type {RestartNodeArgs} from '../../polar_methods/index.js';
import {networkById} from '../network_file.js';
import {startNode} from '../node_actions.js';
import {stopNode} from '../node_actions.js';
import {delay} from '../wait_for.js';
import {findNode} from './find_node.js';
import type {ToolArgs} from './types.js';
import {validateNetworkId} from './validate.js';
import {validateRequired} from './validate.js';

// Wait between the stop and the start, as Polar does
const restartDelayMs = 100;

/** Stop a node and start it again, and wait until the node is online

  A node with the Error status only starts, as in Polar
*/
export default async ({args, dataDir}: ToolArgs<RestartNodeArgs>) => {
  validateNetworkId(args.networkId);
  validateRequired(args.nodeName, 'Node name');

  const network = await networkById({dataDir, id: args.networkId});

  const node = findNode({network, nodeName: args.nodeName});

  if (!['Error', 'Locked', 'Started'].includes(node.status)) {
    throw new Error(
      `Cannot restart node "${args.nodeName}". Node is currently ${node.status}. ` +
        'Only Started or Error nodes can be restarted.',
    );
  }

  if (node.status !== 'Error') {
    await stopNode({dataDir, network, node});

    await delay(restartDelayMs);
  }

  await startNode({dataDir, network, node});

  return {
    success: true,
    message: `Node "${args.nodeName}" restarted successfully`,
    networkId: args.networkId,
    nodeName: args.nodeName,
    nodeStatus: node.status,
  };
};
