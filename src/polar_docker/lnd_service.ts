// Ported from jamaljsr/polar (MIT): src/lib/lightning/lnd/lndService.ts.

import type {AuthenticatedLnd} from '../lnd_grpc/index.js';
import type {LndNode} from '../typescript/index.js';
import lndClient from './lnd_client.js';
import {mapOpenChannel} from './lnd_mappers.js';
import {mapPendingChannel} from './lnd_mappers.js';
import type {LndPendingChannel} from './lnd_mappers.js';
import type {AddInvoiceResponse} from './lnd_responses.js';
import type {ChannelEdge} from './lnd_responses.js';
import type {ChannelPoint} from './lnd_responses.js';
import type {GetInfoResponse} from './lnd_responses.js';
import type {GetStateResponse} from './lnd_responses.js';
import type {ListChannelsResponse} from './lnd_responses.js';
import type {ListPeersResponse} from './lnd_responses.js';
import type {Payment} from './lnd_responses.js';
import type {PayReq} from './lnd_responses.js';
import type {PendingChannelsResponse} from './lnd_responses.js';
import type {WalletBalanceResponse} from './lnd_responses.js';
import {AbortWaitError} from './wait_for.js';
import {waitFor} from './wait_for.js';

/** Polar Lightning Node Info */
export type LightningNodeInfo = {
  alias: string;
  blockHeight: number;
  numActiveChannels: number;
  numInactiveChannels: number;
  numPendingChannels: number;
  pubkey: string;
  /** First URI (pubkey@host:port), or an empty string */
  rpcUrl: string;
  syncedToChain: boolean;
};

// Time for lnd to send the closing transaction of a cooperative close
const closeTimeoutMs = 60_000;

// With --noseedbackup, lnd shows NON_EXISTING for a short time before it makes
// the wallet, and LOCKED for a short time before it unlocks the wallet
const unstableStateMs = 5000;

/** Run a function with an lnd client, then close the client

  {
    [noMacaroon]: <Use Only the TLS Cert Bool>
    node: <LND Node Object>
  }
  <Use the Client Function>

  @returns via Promise
  <Function Result Value>
*/
export const withLnd = async <T>(
  args: {noMacaroon?: boolean; node: LndNode},
  use: (lnd: AuthenticatedLnd) => Promise<T>,
): Promise<T> => {
  const {close, lnd} = await lndClient(args);

  try {
    return await use(lnd);
  } finally {
    close();
  }
};

/** Get the info of an LND node

  <LND Node Object>

  @returns via Promise
  <Lightning Node Info Object>
*/
export const getInfo = async (node: LndNode): Promise<LightningNodeInfo> => {
  const info = await withLnd<GetInfoResponse>({node}, lnd => {
    return lnd.lightning.getInfo();
  });

  return {
    pubkey: info.identityPubkey,
    alias: info.alias,
    rpcUrl: info.uris[0] || '',
    syncedToChain: info.syncedToChain,
    blockHeight: info.blockHeight,
    numActiveChannels: info.numActiveChannels,
    numPendingChannels: info.numPendingChannels,
    numInactiveChannels: info.numInactiveChannels,
  };
};

/** Connect an LND node to the nodes at a list of URIs

  The node skips its present peers. A failed connection is ignored.

  {
    node: <LND Node Object>
    rpcUrls: [<pubkey@host:port String>]
  }

  @returns via Promise
*/
export const connectPeers = async ({
  node,
  rpcUrls,
}: {
  node: LndNode;
  rpcUrls: string[];
}) => {
  await withLnd({node}, async lnd => {
    const {peers}: ListPeersResponse = await lnd.lightning.listPeers();

    const keys = peers.map(p => p.pubKey);

    for (const url of rpcUrls.filter(u => !keys.includes(u.split('@')[0]))) {
      const [pubkey, host] = url.split('@');

      await lnd.lightning.connectPeer({addr: {host, pubkey}}).catch(() => {});
    }
  });
};

/** Wait until an LND node is fully online

  @rejects
  <AbortWaitError> if the wallet is locked or does not exist

  <LND Node Object>

  @returns via Promise
*/
export const waitUntilOnline = async (node: LndNode) => {
  let since: number | undefined;

  await waitFor({
    check: async () => {
      const {state} = await withLnd<GetStateResponse>(
        {noMacaroon: true, node},
        lnd => {
          return lnd.state.getState();
        },
      );

      if (state === 'LOCKED' || state === 'NON_EXISTING') {
        since ??= Date.now();

        if (Date.now() - since < unstableStateMs) {
          throw new Error('waiting for wallet state to stabilize');
        }

        const reason = state === 'LOCKED' ? 'locked' : 'not-initialized';

        throw new AbortWaitError(`wallet-${reason}`);
      }

      since = undefined;

      // RPC_ACTIVE comes before the p2p server starts, so wait for SERVER_ACTIVE
      if (state !== 'SERVER_ACTIVE') {
        throw new Error(`waiting for SERVER_ACTIVE, current state: ${state}`);
      }

      await getInfo(node);
    },
  });
};

/** Get a new on-chain address of an LND node wallet (P2WKH)

  <LND Node Object>

  @returns via Promise
  {
    address: <Address String>
  }
*/
export const getNewAddress = async (node: LndNode) => {
  const {address} = await withLnd<{address: string}>({node}, lnd => {
    return lnd.lightning.newAddress();
  });

  return {address};
};

/** Get the on-chain balances of an LND node wallet

  <LND Node Object>

  @returns via Promise
  {
    confirmed: <Confirmed Sats String>
    total: <Total Sats String>
    unconfirmed: <Unconfirmed Sats String>
  }
*/
export const getBalances = async (node: LndNode) => {
  const balances = await withLnd<WalletBalanceResponse>({node}, lnd => {
    return lnd.lightning.walletBalance();
  });

  return {
    total: balances.totalBalance,
    confirmed: balances.confirmedBalance,
    unconfirmed: balances.unconfirmedBalance,
  };
};

/** Get the channels that an LND node opened, also the pending channels

  <LND Node Object>

  @returns via Promise
  [<Polar Lightning Channel Object>]
*/
export const getChannels = async (node: LndNode) => {
  const [{channels: open}, pending] = await withLnd({node}, lnd => {
    return Promise.all([
      lnd.lightning.listChannels() as Promise<ListChannelsResponse>,
      lnd.lightning.pendingChannels() as Promise<PendingChannelsResponse>,
    ]);
  });

  const local = (list: {channel: LndPendingChannel}[]) =>
    list.map(c => c.channel).filter(c => c.initiator === 'INITIATOR_LOCAL');

  return [
    ...open.filter(c => c.initiator).map(mapOpenChannel),
    ...local(pending.pendingOpenChannels).map(mapPendingChannel('Opening')),
    ...local(pending.pendingClosingChannels).map(mapPendingChannel('Closing')),
    ...local(pending.pendingForceClosingChannels).map(
      mapPendingChannel('Force Closing'),
    ),
    ...local(pending.waitingCloseChannels).map(
      mapPendingChannel('Waiting to Close'),
    ),
  ];
};

/** Check if an LND node can use a channel for payments

  The channel must be active, and the node graph must have the channel with
  the policies of the 2 nodes. The graph gets the channel about 1 s after the
  channel is active.

  {
    channelPoint: <Funding Outpoint String>
    node: <LND Node Object>
  }

  @returns via Promise
  <Channel Is Ready Bool>
*/
export const isChannelReady = async (args: {
  channelPoint: string;
  node: LndNode;
}) => {
  return await withLnd({node: args.node}, async lnd => {
    const {channels}: ListChannelsResponse = await lnd.lightning.listChannels({
      activeOnly: true,
    });

    const channel = channels.find(c => c.channelPoint === args.channelPoint);

    if (!channel) {
      return false;
    }

    const edge: ChannelEdge | undefined = await lnd.lightning
      .getChanInfo({chanId: channel.chanId})
      .catch(() => undefined);

    return !!edge?.node1Policy && !!edge?.node2Policy;
  });
};

/** Open a channel from an LND node, and connect to the peer first

  {
    amount: <Capacity Sats String>
    from: <LND Node Object>
    isPrivate: <Private Channel Bool>
    toRpcUrl: <Peer pubkey@host:port String>
  }

  @returns via Promise
  {
    index: <Funding Output Index Number>
    txid: <Funding Transaction Id String>
  }
*/
export const openChannel = async (args: {
  amount: string;
  from: LndNode;
  isPrivate: boolean;
  toRpcUrl: string;
}) => {
  await connectPeers({node: args.from, rpcUrls: [args.toRpcUrl]});

  const [toPubKey] = args.toRpcUrl.split('@');

  const res = await withLnd<ChannelPoint>({node: args.from}, lnd => {
    return lnd.lightning.openChannelSync({
      localFundingAmount: args.amount,
      nodePubkeyString: toPubKey,
      private: args.isPrivate,
      satPerVbyte: '1',
    });
  });

  // The funding txid bytes are in the reverse order
  const txid =
    res.fundingTxidStr ||
    (!!res.fundingTxidBytes
      ? Buffer.from(res.fundingTxidBytes).reverse().toString('hex')
      : '');

  return {txid, index: res.outputIndex};
};

/** Close a channel of an LND node cooperatively

  The method returns after lnd sends the closing transaction. Polar does not
  wait for lnd.

  {
    channelPoint: <Funding Outpoint txid:vout String>
    node: <LND Node Object>
  }

  @rejects
  <Error> if lnd does not send the closing transaction in 60 s

  @returns via Promise
*/
export const closeChannel = async (args: {
  channelPoint: string;
  node: LndNode;
}) => {
  const [txid, index] = args.channelPoint.split(':');

  await withLnd({node: args.node}, lnd => {
    const stream = lnd.lightning.closeChannel({
      channelPoint: {fundingTxidStr: txid, outputIndex: parseInt(index)},
    });

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        stream.cancel();

        reject(new Error('Channel close timed out after 60 s'));
      }, closeTimeoutMs);

      const end = (err?: Error) => {
        clearTimeout(timer);

        return !!err ? reject(err) : resolve();
      };

      stream.on('data', () => end());
      stream.on('error', (err: Error) => end(err));
      stream.on('end', () => end(new Error('Channel close stream ended')));
    });
  });
};

/** Create an invoice on an LND node

  The invoice has route hints for the private channels

  {
    amount: <Sats Number>
    [memo]: <Memo String>
    node: <LND Node Object>
  }

  @returns via Promise
  <BOLT 11 Payment Request String>
*/
export const createInvoice = async (args: {
  amount: number;
  memo?: string;
  node: LndNode;
}) => {
  const {paymentRequest} = await withLnd<AddInvoiceResponse>(
    {node: args.node},
    lnd => {
      return lnd.lightning.addInvoice({
        memo: args.memo,
        private: true,
        value: args.amount.toString(),
      });
    },
  );

  return paymentRequest;
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
  const {amount, invoice} = args;

  const feeLimitSat =
    !!amount && amount > 1000 ? Math.floor(amount * 0.05) : 1000;

  return await withLnd({node: args.node}, async lnd => {
    const payReq: PayReq = await lnd.lightning.decodePayReq({payReq: invoice});

    // Do not send an amount if the invoice has an amount
    const amt =
      parseInt(payReq.numSatoshis) > 0 ? undefined : amount?.toString();

    const stream = lnd.router.sendPaymentV2({
      amt,
      feeLimitSat,
      maxParts: 16,
      paymentRequest: invoice,
      timeoutSeconds: 60,
    });

    const payment = await new Promise<Payment>((resolve, reject) => {
      stream.on('data', (payment: Payment) => {
        if (payment.status === 'SUCCEEDED') {
          return resolve(payment);
        }

        if (payment.status === 'FAILED' || payment.status === 'UNKNOWN') {
          return reject(new Error(`Payment failed: ${payment.failureReason}`));
        }
      });

      stream.on('error', (err: Error) => reject(err));
      stream.on('end', () => reject(new Error('Payment stream ended')));
    });

    return {
      amount: parseInt(payReq.numSatoshis),
      preimage: payment.paymentPreimage,
      destination: payReq.destination,
    };
  });
};
