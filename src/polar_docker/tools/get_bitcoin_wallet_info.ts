// Ported from jamaljsr/polar (MIT): src/store/models/mcp/bitcoin/getBitcoinWalletInfo.ts.

import type {GetBitcoinWalletInfoArgs} from '../../polar_methods/index.js';
import {getWalletInfo} from '../bitcoind_service.js';
import {networkById} from '../network_file.js';
import {findBitcoinNode} from './find_node.js';
import type {ToolArgs} from './types.js';
import {validateNetworkId} from './validate.js';

/** Get the wallet info of a bitcoin node (default: the first node) */
export default async ({args, folder}: ToolArgs<GetBitcoinWalletInfoArgs>) => {
  validateNetworkId(args.networkId);

  const network = await networkById({folder, id: args.networkId});

  const node = findBitcoinNode({network, nodeName: args.nodeName});

  const walletInfo = await getWalletInfo(node);

  return {
    success: true,
    nodeName: node.name,
    walletInfo: {
      ...walletInfo,
      balance: walletInfo.balance ?? 0,
      txcount: walletInfo.txcount ?? 0,
    },
  };
};
