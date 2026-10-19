// Ported from jamaljsr/polar (MIT): src/store/models/lightning.ts (depositFunds,
// openChannel, closeChannel, payInvoice, waitForNodes).

import type {LndNode} from '../typescript/index.js';
import type {Network} from '../typescript/index.js';
import * as bitcoind from './bitcoind_service.js';
import {blocksTilConfirmed} from './docker_configs.js';
import * as lnd from './lnd_service.js';
import {delay} from './wait_for.js';
import {waitFor} from './wait_for.js';

// Polar waits 1 s for LND nodes to process new blocks and payments
const lndDelayMs = 1000;

// Polar waits 0.5 s for bitcoind to get a new transaction or a new block
const propagationDelayMs = 500;

// Time for LND to show new coins and new channels
const syncTimeoutMs = 60_000;

// Mine blocks to confirm transactions, as Polar does
const mineToConfirm = async (network: Network, backendName?: string) => {
  const {bitcoin} = network.nodes;

  const node = bitcoin.find(n => n.name === backendName) || bitcoin[0];

  await bitcoind.mine({blocks: blocksTilConfirmed, node});

  await delay(propagationDelayMs);
};

/** Send coins from the first bitcoind node to an LND node, and confirm them

  The method returns after the LND wallet shows the coins as confirmed. Polar
  waits 1 s.

  {
    network: <Network Object>
    node: <LND Node Object>
    sats: <Sats Number>
  }

  @returns via Promise
*/
export const depositFunds = async (args: {
  network: Network;
  node: LndNode;
  sats: number;
}) => {
  const [btcNode] = args.network.nodes.bitcoin;

  const before = await lnd.getBalances(args.node);
  const {address} = await lnd.getNewAddress(args.node);

  await bitcoind.sendFunds({
    amount: args.sats / 1e8,
    node: btcNode,
    toAddress: address,
  });

  await mineToConfirm(args.network);

  const expected = Number(before.confirmed) + args.sats;

  await waitFor({
    check: async () => {
      const {confirmed} = await lnd.getBalances(args.node);

      if (Number(confirmed) < expected) {
        throw new Error(`Deposit is not confirmed: ${confirmed} sats`);
      }
    },
    timeout: syncTimeoutMs,
  });
};

/** Open a channel between 2 LND nodes, and confirm it

  The method returns after the 2 nodes can use the channel for payments.
  Polar waits 1 s, and the first payment can fail.

  {
    autoFund: <Deposit 2x the Capacity to the Opener First Bool>
    from: <LND Node Object>
    isPrivate: <Private Channel Bool>
    network: <Network Object>
    sats: <Capacity Sats Number>
    to: <LND Node Object>
  }

  @returns via Promise
  <Funding Outpoint txid:vout String>
*/
export const openChannel = async (args: {
  autoFund: boolean;
  from: LndNode;
  isPrivate: boolean;
  network: Network;
  sats: number;
  to: LndNode;
}) => {
  const {from, network, to} = args;

  if (args.autoFund) {
    await depositFunds({network, node: from, sats: args.sats * 2});
  }

  const {rpcUrl} = await lnd.getInfo(to);

  const {index, txid} = await lnd.openChannel({
    amount: args.sats.toString(),
    from,
    isPrivate: args.isPrivate,
    toRpcUrl: rpcUrl,
  });

  const channelPoint = `${txid}:${index}`;

  await delay(propagationDelayMs);

  await mineToConfirm(network, from.backendName);

  for (const node of [from, to]) {
    await waitFor({
      check: async () => {
        if (!(await lnd.isChannelReady({channelPoint, node}))) {
          throw new Error(`Channel is not ready on ${node.name}`);
        }
      },
      timeout: syncTimeoutMs,
    });
  }

  return channelPoint;
};

/** Close a channel of an LND node cooperatively, and confirm the close

  {
    channelPoint: <Funding Outpoint txid:vout String>
    network: <Network Object>
    node: <LND Node Object>
  }

  @returns via Promise
*/
export const closeChannel = async (args: {
  channelPoint: string;
  network: Network;
  node: LndNode;
}) => {
  await lnd.closeChannel({channelPoint: args.channelPoint, node: args.node});

  await delay(lndDelayMs);

  await mineToConfirm(args.network);

  await delay(lndDelayMs);
};

/** Pay an invoice from an LND node

  {
    [amount]: <Sats for an Invoice Without an Amount Number>
    invoice: <BOLT 11 Payment Request String>
    node: <LND Node Object>
  }

  @returns via Promise
  {
    amount: <Invoice Sats Number>
    destination: <Destination Public Key String>
    preimage: <Payment Preimage Hex String>
  }
*/
export const payInvoice = async (args: {
  amount?: number;
  invoice: string;
  node: LndNode;
}) => {
  const receipt = await lnd.payInvoice(args);

  await delay(lndDelayMs);

  return receipt;
};
