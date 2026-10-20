import {deepStrictEqual} from 'node:assert/strict';
import test from 'node:test';

import monitorStartup from '../../src/polar_docker/monitor_startup.js';
import type {StartupServices} from '../../src/polar_docker/monitor_startup.js';
import newNetwork from '../../src/polar_docker/new_network.js';
import planNetwork from '../../src/polar_docker/plan_network.js';
import {AbortWaitError} from '../../src/polar_docker/wait_for.js';
import type {LndNode} from '../../src/index.js';

// Make a stopped network with 1 bitcoind node and 2 LND nodes
const makeNetwork = () =>
  newNetwork({
    dataDir: '/data',
    description: '',
    id: 1,
    name: 'n',
    plan: planNetwork({}),
  });

const unexpected = async () => {
  throw new Error('UnexpectedCallToBitcoind');
};

// Fake node services, with an LND wait result for each node name
const fakeServices = (waits: {
  [name: string]: () => Promise<void>;
}): StartupServices => ({
  bitcoind: {
    connectPeers: unexpected,
    createDefaultWallet: unexpected,
    mine: unexpected,
    waitUntilOnline: unexpected,
  },
  lnd: {
    connectPeers: async () => {},
    getInfo: async () => {
      throw new Error('NoInfo');
    },
    waitUntilOnline: (node: LndNode) => waits[node.name](),
  },
});

test('A locked LND wallet gives the Error status and a message', async () => {
  const network = makeNetwork();

  const services = fakeServices({
    alice: async () => {
      throw new AbortWaitError('wallet-locked');
    },
    bob: async () => {
      throw new AbortWaitError('wallet-not-initialized');
    },
  });

  await monitorStartup({network, nodes: network.nodes.lightning, services});

  deepStrictEqual(
    network.nodes.lightning.map(n => [n.name, n.status, n.errorMsg]),
    [
      ['alice', 'Error', 'The LND wallet is locked'],
      ['bob', 'Error', 'The LND wallet does not exist'],
    ],
    'Polar v4.0.0 has no Locked status',
  );
});

test('An LND node that is online gets the Started status', async () => {
  const network = makeNetwork();

  const services = fakeServices({
    alice: async () => {},
    bob: async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:10002');
    },
  });

  await monitorStartup({network, nodes: network.nodes.lightning, services});

  deepStrictEqual(
    network.nodes.lightning.map(n => [n.name, n.status, n.errorMsg]),
    [
      ['alice', 'Started', undefined],
      ['bob', 'Error', 'connect ECONNREFUSED 127.0.0.1:10002'],
    ],
    'Got the node statuses',
  );
});
