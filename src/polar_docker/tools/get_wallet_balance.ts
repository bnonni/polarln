// Ported from jamaljsr/polar (MIT): src/store/models/mcp/lightning/wallet/getWalletBalance.ts.

import type {GetWalletBalanceArgs} from '../../polar_methods/index.js';
import {getBalances} from '../lnd_service.js';
import {networkById} from '../network_file.js';
import {findLndNode} from './find_node.js';
import type {ToolArgs} from './types.js';
import {validateNetworkId} from './validate.js';
import {validateRequired} from './validate.js';

/** Get the on-chain balance of a lightning node */
export default async ({args, folder}: ToolArgs<GetWalletBalanceArgs>) => {
  validateNetworkId(args.networkId);
  validateRequired(args.nodeName, 'Node name');

  const network = await networkById({folder, id: args.networkId});

  const node = findLndNode({network, nodeName: args.nodeName});

  const balance = await getBalances(node);

  return {
    success: true,
    message: `Retrieved balance for node "${args.nodeName}": ${balance.total} sats total`,
    networkId: args.networkId,
    nodeName: args.nodeName,
    balance,
  };
};
