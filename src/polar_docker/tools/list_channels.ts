// Ported from jamaljsr/polar (MIT): src/store/models/mcp/lightning/channels/listChannels.ts.

import type {ListChannelsArgs} from '../../polar_methods/index.js';
import type {LndNode} from '../../typescript/index.js';
import type {Network} from '../../typescript/index.js';
import type {LightningChannel} from '../lnd_mappers.js';
import {getChannels} from '../lnd_service.js';
import {getInfo} from '../lnd_service.js';
import {networkById} from '../network_file.js';
import {findLndNode} from './find_node.js';
import {hasLnd} from './find_node.js';
import type {ToolArgs} from './types.js';
import {validateNetworkId} from './validate.js';
import {validateRequired} from './validate.js';

/** lnd Methods That the Channel List Uses */
export type ChannelServices = {
  getChannels: typeof getChannels;
  getInfo: typeof getInfo;
};

/** Get the channels of a node, and the channels of the other nodes to it

  The LND and litd nodes are in the list. A node that does not answer is
  skipped. A channel of a different node shows the balances as the node sees
  them.

  {
    network: <Network Object>
    node: <LND or litd Node Object>
    [services]: <lnd Methods Object> // Default: the lnd gRPC methods
  }

  @throws
  <Error>

  @returns via Promise
  [<Polar Lightning Channel Object>]
*/
export const nodeChannels = async ({
  network,
  node,
  services = {getChannels, getInfo},
}: {
  network: Network;
  node: LndNode;
  services?: ChannelServices;
}) => {
  const {pubkey} = await services.getInfo(node);

  const lists = await Promise.all(
    network.nodes.lightning.map(async peer => {
      // polarDocker has no service for the other node kinds yet
      if (!hasLnd(peer)) {
        return [] as LightningChannel[];
      }

      try {
        const [info, channels] = await Promise.all([
          services.getInfo(peer),
          services.getChannels(peer),
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

  return lists.flat();
};

/** List the channels of a lightning node

  The list has the channels that the node opened, and the channels that the
  other nodes of the network opened to the node. The LND and litd nodes are
  in the list. A node that does not answer is skipped.

  The channels are in the order of the nodes. In Polar, the order can change.
*/
export default async ({args, folder}: ToolArgs<ListChannelsArgs>) => {
  validateNetworkId(args.networkId);
  validateRequired(args.nodeName, 'Node name');

  const network = await networkById({folder, id: args.networkId});

  const node = findLndNode({network, nodeName: args.nodeName});

  const channels = await nodeChannels({network, node});

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
