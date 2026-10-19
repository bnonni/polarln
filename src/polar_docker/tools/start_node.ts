// Ported from jamaljsr/polar (MIT): src/store/models/mcp/network/startNode.ts.

import type {StartNodeArgs} from '../../polar_methods/index.js';
import {networkById} from '../network_file.js';
import {startNode} from '../node_actions.js';
import {findNode} from './find_node.js';
import type {ToolArgs} from './types.js';
import {validateNetworkId} from './validate.js';
import {validateRequired} from './validate.js';

/** Start a stopped node, and wait until the node is online

  Polar returns before the node is online, with the Starting status
*/
export default async ({args, dataDir}: ToolArgs<StartNodeArgs>) => {
  validateNetworkId(args.networkId);
  validateRequired(args.nodeName, 'Node name');

  const network = await networkById({dataDir, id: args.networkId});

  const node = findNode({network, nodeName: args.nodeName});

  if (node.status !== 'Stopped' && node.status !== 'Error') {
    throw new Error(
      `Cannot start node "${args.nodeName}". Node is currently ${node.status}. ` +
        'Only Stopped or Error nodes can be started.',
    );
  }

  await startNode({dataDir, network, node});

  return {
    success: true,
    message: `Node "${args.nodeName}" started successfully`,
    networkId: args.networkId,
    nodeName: args.nodeName,
    nodeStatus: node.status,
  };
};
