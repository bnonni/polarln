// Ported from jamaljsr/polar (MIT): src/store/models/mcp/bitcoin/sendBitcoin.ts,
// src/store/models/bitcoin.ts (sendFunds, mine).

import type {SendBitcoinArgs} from '../../polar_methods/index.js';
import {mine} from '../bitcoind_service.js';
import {sendFunds} from '../bitcoind_service.js';
import {blocksTilConfirmed} from '../docker_configs.js';
import {networkById} from '../network_file.js';
import {delay} from '../wait_for.js';
import {findBitcoinNode} from './find_node.js';
import type {ToolArgs} from './types.js';
import {validateNetworkId} from './validate.js';
import {validatePositiveNumber} from './validate.js';
import {validateRequired} from './validate.js';

// Give the other nodes time to get the new blocks, as Polar does
const propagationDelayMs = 500;

/** Send coins from a bitcoin node wallet to an address

  If the wallet does not have the coins, the node mines them first
*/
export default async ({args, dataDir}: ToolArgs<SendBitcoinArgs>) => {
  validateNetworkId(args.networkId);
  validateRequired(args.fromNode, 'From node name');
  validateRequired(args.toAddress, 'To address');
  validatePositiveNumber(args.amount, 'Amount');

  const amount = args.amount as number;
  const toAddress = args.toAddress as string;

  const network = await networkById({dataDir, id: args.networkId});

  const node = findBitcoinNode({network, nodeName: args.fromNode});

  const txid = await sendFunds({amount, node, toAddress});

  const autoMined = args.autoMine ?? false;

  if (autoMined) {
    await mine({blocks: blocksTilConfirmed, node});

    await delay(propagationDelayMs);
  }

  return {
    success: true,
    message:
      `Sent ${amount} bitcoin from "${args.fromNode}" to ${toAddress}` +
      (autoMined ? ' (auto-mined 6 blocks)' : ''),
    networkId: args.networkId,
    fromNode: args.fromNode,
    toAddress,
    amount,
    txid,
    autoMined: autoMined || undefined,
  };
};
