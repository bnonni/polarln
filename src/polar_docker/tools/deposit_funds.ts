// Ported from jamaljsr/polar (MIT): src/store/models/mcp/lightning/wallet/depositFunds.ts.

import type {DepositFundsArgs} from '../../polar_methods/index.js';
import {depositFunds} from '../lightning_actions.js';
import {networkById} from '../network_file.js';
import {findLndNode} from './find_node.js';
import type {ToolArgs} from './types.js';
import {validateNetworkId} from './validate.js';
import {validatePositiveNumber} from './validate.js';
import {validateRequired} from './validate.js';

/** Send coins from the first bitcoin node to a lightning node, and confirm them

  The tool returns after the lightning node shows the coins as confirmed
*/
export default async ({args, dataDir}: ToolArgs<DepositFundsArgs>) => {
  validateNetworkId(args.networkId);
  validateRequired(args.nodeName, 'Node name');
  validatePositiveNumber(args.sats, 'Amount in sats');

  const network = await networkById({dataDir, id: args.networkId});

  const node = findLndNode({network, nodeName: args.nodeName});

  await depositFunds({network, node, sats: args.sats as number});

  return {
    success: true,
    message: `Deposited ${args.sats} sats to node "${args.nodeName}"`,
    networkId: args.networkId,
    nodeName: args.nodeName,
    sats: args.sats,
  };
};
