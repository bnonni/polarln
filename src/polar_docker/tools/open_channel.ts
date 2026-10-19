// Ported from jamaljsr/polar (MIT): src/store/models/mcp/lightning/channels/openChannel.ts.

import type {OpenChannelArgs} from '../../polar_methods/index.js';
import {openChannel} from '../lightning_actions.js';
import {networkById} from '../network_file.js';
import {findLndNode} from './find_node.js';
import type {ToolArgs} from './types.js';
import {validateNetworkId} from './validate.js';
import {validatePositiveNumber} from './validate.js';
import {validateRequired} from './validate.js';

/** Open a channel between 2 lightning nodes, and confirm it

  By default, the opener gets 2x the capacity from the first bitcoin node
  first. The tool returns after the 2 nodes can use the channel for payments.
*/
export default async ({args, dataDir}: ToolArgs<OpenChannelArgs>) => {
  validateNetworkId(args.networkId);
  validateRequired(args.fromNode, 'From node name');
  validateRequired(args.toNode, 'To node name');
  validatePositiveNumber(args.sats, 'Channel capacity in sats');

  const network = await networkById({dataDir, id: args.networkId});

  const from = findLndNode({network, nodeName: args.fromNode});
  const to = findLndNode({network, nodeName: args.toNode});

  if (from.name === to.name) {
    throw new Error('Cannot open channel between the same node');
  }

  const channelPoint = await openChannel({
    autoFund: args.autoFund ?? true,
    from,
    isPrivate: args.isPrivate ?? false,
    network,
    sats: args.sats as number,
    to,
  });

  return {
    success: true,
    message:
      `Opened channel from "${args.fromNode}" to "${args.toNode}" with ` +
      `capacity ${args.sats} sats`,
    networkId: args.networkId,
    fromNode: args.fromNode,
    toNode: args.toNode,
    capacity: args.sats,
    channelPoint,
  };
};
