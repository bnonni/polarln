// Ported from jamaljsr/polar (MIT): src/lib/bitcoin/bitcoind/bitcoindService.ts.

import type {BitcoinNode} from '../typescript/index.js';
import bitcoindRpc from './bitcoind_rpc.js';
import {waitFor} from './wait_for.js';

/** Connect a bitcoind node to its peers, so blocks and txs go fast

  A failed peer connection is ignored

  <bitcoind Node Object>

  @returns via Promise
*/
export const connectPeers = async (node: BitcoinNode) => {
  for (const peer of node.peers) {
    await bitcoindRpc({method: 'addnode', node, params: [peer, 'add']}).catch(
      () => {},
    );
  }
};

/** Make the default wallet if the node has no wallet

  bitcoind v0.21.0 and up do not make a default wallet

  <bitcoind Node Object>

  @returns via Promise
*/
export const createDefaultWallet = async (node: BitcoinNode) => {
  const wallets = await bitcoindRpc<string[]>({method: 'listwallets', node});

  if (!wallets.length) {
    await bitcoindRpc({method: 'createwallet', node, params: ['']});
  }
};

/** Mine blocks to a new address of the node wallet

  {
    blocks: <Number of Blocks Number>
    node: <bitcoind Node Object>
  }

  @returns via Promise
  [<Block Hash String>]
*/
export const mine = async ({
  blocks,
  node,
}: {
  blocks: number;
  node: BitcoinNode;
}) => {
  const address = await bitcoindRpc<string>({method: 'getnewaddress', node});

  return await bitcoindRpc<string[]>({
    method: 'generatetoaddress',
    node,
    params: [blocks, address],
  });
};

/** Wait until the node answers RPC calls

  <bitcoind Node Object>

  @returns via Promise
*/
export const waitUntilOnline = async (node: BitcoinNode) => {
  await waitFor({
    check: () => bitcoindRpc({method: 'getblockchaininfo', node}),
  });
};
