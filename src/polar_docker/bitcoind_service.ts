// Ported from jamaljsr/polar (MIT): src/lib/bitcoin/bitcoind/bitcoindService.ts.

import type {BitcoinNode} from '../typescript/index.js';
import bitcoindRpc from './bitcoind_rpc.js';
import {delay} from './wait_for.js';
import {waitFor} from './wait_for.js';

/** bitcoind getblockchaininfo Result (the fields that Polar reads) */
export type BlockchainInfo = {
  bestblockhash: string;
  blocks: number;
  chain: string;
  difficulty: number;
  headers: number;
  mediantime: number;
  verificationprogress: number;
};

type Balances = {
  mine: {immature: number; trusted: number; untrusted_pending: number};
};

// Polar regtest values: coinbase maturity, halving blocks, and first reward
const coinbaseMaturity = 100;
const halvingInterval = 150;
const initialBlockReward = 50;

const getBalances = (node: BitcoinNode) =>
  bitcoindRpc<Balances>({method: 'getbalances', node});

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

/** Get the blockchain info of a node

  <bitcoind Node Object>

  @returns via Promise
  <bitcoind getblockchaininfo Result Object>
*/
export const getBlockchainInfo = (node: BitcoinNode) =>
  bitcoindRpc<BlockchainInfo>({method: 'getblockchaininfo', node});

/** Get the wallet info of a node, with the balance fields before v30

  <bitcoind Node Object>

  @returns via Promise
  <bitcoind getwalletinfo Result With Balances Object>
*/
export const getWalletInfo = async (node: BitcoinNode) => {
  const info = await bitcoindRpc<{txcount?: number; walletname: string}>({
    method: 'getwalletinfo',
    node,
  });

  const {mine} = await getBalances(node);

  // bitcoind v30 has the balances only in getbalances
  return {
    ...info,
    balance: mine.trusted,
    unconfirmed_balance: mine.untrusted_pending,
    immature_balance: mine.immature,
  };
};

/** Get a new address of the node wallet

  <bitcoind Node Object>

  @returns via Promise
  <Address String>
*/
export const getNewAddress = (node: BitcoinNode) =>
  bitcoindRpc<string>({method: 'getnewaddress', node});

// The number of blocks that give an amount of coins, minimum 1 block
const blocksToMine = (height: number, coins: number) => {
  // Polar divides the first reward by the halving period number
  const reward = initialBlockReward / Math.ceil(height / halvingInterval);

  return Math.floor(coins < reward ? 1 : coins / reward);
};

// Mine until the coinbase outputs of the node wallet can be spent
const mineUntilMaturity = async (node: BitcoinNode) => {
  const txs = await bitcoindRpc<{confirmations: number}[]>({
    method: 'listtransactions',
    node,
  });

  const confs = Math.max(0, ...txs.map(tx => tx.confirmations));

  const needed = Math.max(0, coinbaseMaturity - confs);

  if (needed > 0) {
    await mine({blocks: needed, node});

    // Give the other nodes time to process the new blocks
    await delay(2000);
  }
};

/** Send coins from the node wallet, and mine coins first if they are needed

  {
    amount: <BTC Amount Number>
    node: <bitcoind Node Object>
    toAddress: <Address String>
  }

  @returns via Promise
  <Transaction Id String>
*/
export const sendFunds = async ({
  amount,
  node,
  toAddress,
}: {
  amount: number;
  node: BitcoinNode;
  toAddress: string;
}) => {
  const {blocks} = await getBlockchainInfo(node);
  const balance = (await getBalances(node)).mine.trusted;

  if (balance <= amount) {
    await mineUntilMaturity(node);
    await mine({blocks: blocksToMine(blocks, amount - balance), node});
  }

  return await bitcoindRpc<string>({
    method: 'sendtoaddress',
    node,
    params: [toAddress, amount],
  });
};
