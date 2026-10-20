// Ported from jamaljsr/polar (MIT): src/store/models/network.ts (monitorStartup),
// src/store/models/lightning.ts (connectAllPeers).

import type {LndNode} from '../typescript/index.js';
import type {Network} from '../typescript/index.js';
import type {PolarNode} from '../typescript/index.js';
import type {Status} from '../typescript/index.js';
import * as bitcoind from './bitcoind_service.js';
import * as lnd from './lnd_service.js';
import setStatus from './set_status.js';
import {AbortWaitError} from './wait_for.js';
import {delay} from './wait_for.js';

/** Node Services That the Startup Wait Uses */
export type StartupServices = {
  bitcoind: Pick<
    typeof bitcoind,
    'connectPeers' | 'createDefaultWallet' | 'mine' | 'waitUntilOnline'
  >;
  lnd: Pick<typeof lnd, 'connectPeers' | 'getInfo' | 'waitUntilOnline'>;
};

const asError = (err: unknown) =>
  err instanceof Error ? err : new Error(String(err));
const mineDelayMs = 2000;

// Polar v4.0.0 has no Locked status, so a wallet that stays locked is an error
const walletErrors: {[reason: string]: string} = {
  'wallet-locked': 'The LND wallet is locked',
  'wallet-not-initialized': 'The LND wallet does not exist',
};

// Connect each lightning node to all of the others, so each node knows the graph
const connectAllPeers = async (
  nodes: LndNode[],
  lnd: StartupServices['lnd'],
) => {
  const infos = await Promise.all(
    nodes.map(n => lnd.getInfo(n).catch(() => undefined)),
  );

  const pubkeys = new Map(infos.filter(i => !!i).map(i => [i.alias, i.pubkey]));
  const rpcUrls = infos.filter(i => !!i).map(i => i.rpcUrl);

  for (const node of nodes) {
    const pubkey = pubkeys.get(node.name);

    const urls = !!pubkey
      ? rpcUrls.filter(u => !u.startsWith(pubkey))
      : rpcUrls;

    await lnd.connectPeers({node, rpcUrls: urls}).catch(() => {});
  }
};

/** Wait for started nodes, and set their statuses

  After the bitcoind nodes are online, mine 1 block. After the LND nodes are
  online, connect all of the LND nodes of the network to each other. A node
  that does not start gets the Error status. An LND node with a wallet that
  stays locked also gets the Error status, with an error message.

  {
    network: <Network Object>
    [nodes]: [<Started Node Object>] // Default: all bitcoind and LND nodes
    [services]: <Node Services Object> // Default: the bitcoind and LND RPC
  }

  @returns via Promise
*/
export default async ({
  network,
  nodes,
  services = {bitcoind, lnd},
}: {
  network: Network;
  nodes?: PolarNode[];
  services?: StartupServices;
}) => {
  const started = nodes || [
    ...network.nodes.bitcoin,
    ...network.nodes.lightning,
  ];

  const bitcoin = started.filter(n => n.type === 'bitcoin');
  const lndNodes = started.filter(n => n.implementation === 'LND');

  const setNode = (name: string, status: Status, error?: Error) =>
    setStatus({error, network, only: name, status});

  const btcOnline = bitcoin.map(node => {
    return services.bitcoind
      .waitUntilOnline(node)
      .then(async () => {
        setNode(node.name, 'Started');

        await services.bitcoind.connectPeers(node);
        await services.bitcoind.createDefaultWallet(node);
      })
      .catch(err => setNode(node.name, 'Error', asError(err)));
  });

  const lnOnline = lndNodes.map(node => {
    return services.lnd
      .waitUntilOnline(node)
      .then(() => setNode(node.name, 'Started'))
      .catch(err => {
        if (err instanceof AbortWaitError) {
          const message = walletErrors[err.message] || err.message;

          return setNode(node.name, 'Error', new Error(message));
        }

        return setNode(node.name, 'Error', asError(err));
      });
  });

  if (!!btcOnline.length) {
    await Promise.all(btcOnline);
    await delay(mineDelayMs);
    await services.bitcoind
      .mine({blocks: 1, node: network.nodes.bitcoin[0]})
      .catch(() => {});
  }

  if (!!lnOnline.length) {
    await Promise.all(lnOnline);
    await connectAllPeers(
      network.nodes.lightning.filter(n => n.implementation === 'LND'),
      services.lnd,
    );
  }
};
