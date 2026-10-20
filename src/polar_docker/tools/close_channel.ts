// Ported from jamaljsr/polar (MIT): src/store/models/mcp/lightning/channels/closeChannel.ts.

import type {CloseChannelArgs} from '../../polar_methods/index.js';
import {closeChannel} from '../lightning_actions.js';
import {networkById} from '../network_file.js';
import {findLndNode} from './find_node.js';
import type {ToolArgs} from './types.js';
import {validateNetworkId} from './validate.js';
import {validateRequired} from './validate.js';

/** Close a channel cooperatively, and confirm the close

  The tool rejects if lnd cannot close the channel. Polar does not wait for
  lnd, so Polar does not reject.
*/
export default async ({args, folder}: ToolArgs<CloseChannelArgs>) => {
  validateNetworkId(args.networkId);
  validateRequired(args.nodeName, 'Node name');
  validateRequired(args.channelPoint, 'Channel point');

  const network = await networkById({folder, id: args.networkId});

  const node = findLndNode({network, nodeName: args.nodeName});

  await closeChannel({
    channelPoint: args.channelPoint as string,
    network,
    node,
  });

  return {
    success: true,
    message: `Closed channel "${args.channelPoint}" on node "${args.nodeName}"`,
    networkId: args.networkId,
    nodeName: args.nodeName,
    channelPoint: args.channelPoint,
  };
};
