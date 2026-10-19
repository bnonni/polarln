// Ported from jamaljsr/polar (MIT): src/store/models/mcp/lightning/channels/listChannels.ts.

import type {ListChannelsArgs} from '../../polar_methods/index.js';
import type {LndNode} from '../../typescript/index.js';
import type {LightningChannel} from '../lnd_mappers.js';
import {getChannels} from '../lnd_service.js';
import {getInfo} from '../lnd_service.js';
import {networkById} from '../network_file.js';
import {findLndNode} from './find_node.js';
import type {ToolArgs} from './types.js';
import {validateDockerImplementation} from './validate.js';
import {validateNetworkId} from './validate.js';
import {validateRequired} from './validate.js';

/** List the channels of a lightning node

  The list has the channels that the node opened, and the channels that the
  other nodes of the network opened to the node. A node that does not answer
  is skipped.

  The channels are in the order of the nodes. In Polar, the order can change.
*/
export default async ({args, dataDir}: ToolArgs<ListChannelsArgs>) => {
  validateNetworkId(args.networkId);
  validateRequired(args.nodeName, 'Node name');

  const network = await networkById({dataDir, id: args.networkId});

  const node = findLndNode({network, nodeName: args.nodeName});

  const {pubkey} = await getInfo(node);

  const lists = await Promise.all(
    network.nodes.lightning.map(async peer => {
      try {
        validateDockerImplementation(peer.implementation);

        const [info, channels] = await Promise.all([
          getInfo(peer as LndNode),
          getChannels(peer as LndNode),
        ]);

        if (peer.name === node.name) {
          return channels;
        }

        // Show the channels of the peer as the target node sees them
        return channels
          .filter(c => c.pubkey === pubkey)
          .map(c => ({
            ...c,
            pubkey: info.pubkey,
            localBalance: c.remoteBalance,
            remoteBalance: c.localBalance,
          }));
      } catch {
        return [] as LightningChannel[];
      }
    }),
  );

  const channels = lists.flat();

  return {
    success: true,
    message:
      `Found ${channels.length} channel${channels.length === 1 ? '' : 's'} ` +
      `for node "${args.nodeName}"`,
    networkId: args.networkId,
    nodeName: args.nodeName,
    channels,
  };
};
