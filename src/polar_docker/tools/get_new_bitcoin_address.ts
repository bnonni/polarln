// Ported from jamaljsr/polar (MIT): src/store/models/mcp/bitcoin/getNewBitcoinAddress.ts.

import type {GetNewBitcoinAddressArgs} from '../../polar_methods/index.js';
import type {BitcoinNode} from '../../typescript/index.js';
import type {LightningNode} from '../../typescript/index.js';
import type {LndNode} from '../../typescript/index.js';
import type {Network} from '../../typescript/index.js';
import * as bitcoind from '../bitcoind_service.js';
import * as lnd from '../lnd_service.js';
import {networkById} from '../network_file.js';
import {findBitcoinNode} from './find_node.js';
import {findLightningNode} from './find_node.js';
import type {ToolArgs} from './types.js';
import {validateDockerImplementation} from './validate.js';
import {validateNetworkId} from './validate.js';

// Get a node by name (a bitcoin node first), or the first node
const findAnyNode = ({
  network,
  nodeName,
}: {
  network: Network;
  nodeName?: string;
}): BitcoinNode | LightningNode => {
  const {bitcoin, lightning} = network.nodes;

  if (!!nodeName) {
    try {
      return findBitcoinNode({network, nodeName});
    } catch {
      return findLightningNode({network, nodeName});
    }
  }

  const [node] = [...bitcoin, ...lightning];

  if (!node) {
    throw new Error('Network has no Bitcoin or Lightning nodes');
  }

  return node;
};

/** Get a new address from a bitcoin or a lightning node

  The default node is the first bitcoin node
*/
export default async ({args, dataDir}: ToolArgs<GetNewBitcoinAddressArgs>) => {
  validateNetworkId(args.networkId);

  const network = await networkById({dataDir, id: args.networkId});

  const node = findAnyNode({network, nodeName: args.nodeName});

  if (node.type === 'lightning') {
    validateDockerImplementation(node.implementation);
  }

  const address =
    node.type === 'bitcoin'
      ? await bitcoind.getNewAddress(node)
      : (await lnd.getNewAddress(node as LndNode)).address;

  return {
    success: true,
    message: `Generated new Bitcoin address for "${node.name}": ${address}`,
    networkId: args.networkId,
    nodeName: node.name,
    address,
    nodeType: node.type,
  };
};
