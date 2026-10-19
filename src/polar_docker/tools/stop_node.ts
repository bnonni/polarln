// Ported from jamaljsr/polar (MIT): src/store/models/mcp/network/stopNode.ts.

import type {StopNodeArgs} from '../../polar_methods/index.js';
import {networkById} from '../network_file.js';
import {stopNode} from '../node_actions.js';
import {findNode} from './find_node.js';
import type {ToolArgs} from './types.js';
import {validateNetworkId} from './validate.js';
import {validateRequired} from './validate.js';

/** Stop a started node */
export default async ({args, dataDir}: ToolArgs<StopNodeArgs>) => {
  validateNetworkId(args.networkId);
  validateRequired(args.nodeName, 'Node name');

  const network = await networkById({dataDir, id: args.networkId});

  const node = findNode({network, nodeName: args.nodeName});

  if (node.status !== 'Started' && node.status !== 'Locked') {
    throw new Error(
      `Cannot stop node "${args.nodeName}". Node is currently ${node.status}. ` +
        'Only Started nodes can be stopped.',
    );
  }

  await stopNode({dataDir, network, node});

  return {
    success: true,
    message: `Node "${args.nodeName}" stopped successfully`,
    networkId: args.networkId,
    nodeName: args.nodeName,
    nodeStatus: node.status,
  };
};
