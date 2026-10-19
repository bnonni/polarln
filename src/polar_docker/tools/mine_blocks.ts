// Ported from jamaljsr/polar (MIT): src/store/models/mcp/bitcoin/mineBlocks.ts,
// src/store/models/bitcoin.ts (mine).

import type {MineBlocksArgs} from '../../polar_methods/index.js';
import {mine} from '../bitcoind_service.js';
import {networkById} from '../network_file.js';
import {delay} from '../wait_for.js';
import {findBitcoinNode} from './find_node.js';
import type {ToolArgs} from './types.js';
import {validateNetworkId} from './validate.js';
import {validatePositiveNumber} from './validate.js';

// Give the other nodes time to get the new blocks, as Polar does
const propagationDelayMs = 500;

/** Mine blocks on a bitcoin node (default: 6 blocks on the first node) */
export default async ({args, dataDir}: ToolArgs<MineBlocksArgs>) => {
  validateNetworkId(args.networkId);

  const blocks = args.blocks ?? 6;

  validatePositiveNumber(blocks, 'Number of blocks');

  const network = await networkById({dataDir, id: args.networkId});

  const node = findBitcoinNode({network, nodeName: args.nodeName});

  await mine({blocks, node});

  await delay(propagationDelayMs);

  return {
    success: true,
    message: `Mined ${blocks} block${blocks > 1 ? 's' : ''} on node "${node.name}"`,
    networkId: args.networkId,
    nodeName: node.name,
    blocksMined: blocks,
  };
};
