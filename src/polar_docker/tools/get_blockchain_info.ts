// Ported from jamaljsr/polar (MIT): src/store/models/mcp/bitcoin/getBlockchainInfo.ts.

import type {GetBlockchainInfoArgs} from '../../polar_methods/index.js';
import {getBlockchainInfo} from '../bitcoind_service.js';
import {networkById} from '../network_file.js';
import {findBitcoinNode} from './find_node.js';
import type {ToolArgs} from './types.js';
import {validateNetworkId} from './validate.js';

/** Get the blockchain info of a bitcoin node (default: the first node) */
export default async ({args, dataDir}: ToolArgs<GetBlockchainInfoArgs>) => {
  validateNetworkId(args.networkId);

  const network = await networkById({dataDir, id: args.networkId});

  const node = findBitcoinNode({network, nodeName: args.nodeName});

  const info = await getBlockchainInfo(node);

  return {
    success: true,
    nodeName: node.name,
    chain: info.chain,
    blocks: info.blocks,
    headers: info.headers,
    bestblockhash: info.bestblockhash,
    difficulty: info.difficulty,
    mediantime: info.mediantime,
    verificationprogress: info.verificationprogress,
  };
};
