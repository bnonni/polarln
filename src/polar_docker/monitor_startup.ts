// Ported from jamaljsr/polar (MIT): src/store/models/network.ts (monitorStartup),
// src/store/models/lightning.ts (connectAllPeers).

import type {LndNode} from '../typescript/index.js';
import type {Network} from '../typescript/index.js';
import type {Status} from '../typescript/index.js';
import * as bitcoind from './bitcoind_service.js';
import * as lnd from './lnd_service.js';
import setStatus from './set_status.js';
import {AbortWaitError} from './wait_for.js';
import {delay} from './wait_for.js';

const asError = (err: unknown) =>
  err instanceof Error ? err : new Error(String(err));
const mineDelayMs = 2000;

// Connect each lightning node to all of the others, so each node knows the graph
const connectAllPeers = async (nodes: LndNode[]) => {
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

/** Wait for the nodes of a started network, and set their statuses

  After all bitcoind nodes are online, mine 1 block. After all LND nodes are
  online, connect them to each other. A node that does not start gets the
  Error status.

  {
    network: <Network Object>
  }

  @returns via Promise
*/
export default async ({network}: {network: Network}) => {
  const {bitcoin, lightning} = network.nodes;

  const setNode = (name: string, status: Status, error?: Error) =>
    setStatus({error, network, only: name, status});

  const lndNodes = lightning.filter(n => n.implementation === 'LND');

  const btcOnline = bitcoin.map(node => {
    return bitcoind
      .waitUntilOnline(node)
      .then(async () => {
        setNode(node.name, 'Started');

        await bitcoind.connectPeers(node);
        await bitcoind.createDefaultWallet(node);
      })
      .catch(err => setNode(node.name, 'Error', asError(err)));
  });

  const lnOnline = lndNodes.map(node => {
    return lnd
      .waitUntilOnline(node)
      .then(() => setNode(node.name, 'Started'))
      .catch(err => {
        if (err instanceof AbortWaitError) {
          return setNode(node.name, 'Locked');
        }

        return setNode(node.name, 'Error', asError(err));
      });
  });

  if (!!btcOnline.length) {
    await Promise.all(btcOnline);
    await delay(mineDelayMs);
    await bitcoind.mine({blocks: 1, node: bitcoin[0]}).catch(() => {});
  }

  if (!!lnOnline.length) {
    await Promise.all(lnOnline);
    await connectAllPeers(lndNodes);
  }
};
