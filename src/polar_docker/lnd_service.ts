// Ported from jamaljsr/polar (MIT): src/lib/lightning/lnd/lndService.ts.

import type {AuthenticatedLnd} from '../lnd_grpc/index.js';
import type {LndNode} from '../typescript/index.js';
import type {GetInfoResponse} from './lnd_responses.js';
import type {GetStateResponse} from './lnd_responses.js';
import type {ListPeersResponse} from './lnd_responses.js';
import lndClient from './lnd_client.js';
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
