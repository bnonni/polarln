import {deepStrictEqual} from 'node:assert/strict';
import test from 'node:test';

import dataFolder from '../../src/polar_docker/data_folder.js';
import monitorStartup from '../../src/polar_docker/monitor_startup.js';
import type {StartupServices} from '../../src/polar_docker/monitor_startup.js';
import newNetwork from '../../src/polar_docker/new_network.js';
import planNetwork from '../../src/polar_docker/plan_network.js';
import {AbortWaitError} from '../../src/polar_docker/wait_for.js';
import type {LndNode} from '../../src/index.js';
import type {Network} from '../../src/index.js';
import type {TapdNode} from '../../src/index.js';
import type {DockerCall} from '../fixtures/fake_docker_runner.js';
import {fakeDockerRunner} from '../fixtures/fake_docker_runner.js';

// Make a stopped network with 1 bitcoind node and 2 LND nodes
const makeNetwork = () =>
  newNetwork({
    dataDir: '/data',
    description: '',
    id: 1,
    name: 'n',
    plan: planNetwork({}),
  });

// Get a data folder with a fake docker runner
const folderOf = (respond?: (call: DockerCall) => string | undefined) => {
  const {calls, docker} = fakeDockerRunner({
    respond:
      respond ||
      (() => {
        throw new Error('UnexpectedDockerCall');
      }),
  });

  return {calls, folder: dataFolder({dataDir: '/data', docker})};
};

// Get a docker ps line of a container of network 1
const psLine = (args: {name: string; network: Network; state: string}) =>
  JSON.stringify([
    `polarln-n1-${args.name}`,
    args.state,
    'polarln-network-1',
    args.network.path,
  ]);

// Add a tapd node to the network, with the first LND node as its backend
const addTapd = (network: Network) => {
  const node: TapdNode = {
    id: 0,
    networkId: network.id,
    name: 'alice-tap',
    type: 'tap',
    implementation: 'tapd',
    version: '0.7.0-alpha',
    status: 'Started',
    lndName: 'alice',
    paths: {adminMacaroon: '', tlsCert: ''},
    ports: {grpc: 12029, rest: 8289},
    docker: {command: '', image: ''},
  };

  network.nodes.tap.push(node);

  return node;
};

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

  const {folder} = folderOf();

  await monitorStartup({
    folder,
    network,
    nodes: network.nodes.lightning,
    services,
  });

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

  const {folder} = folderOf();

  await monitorStartup({
    folder,
    network,
    nodes: network.nodes.lightning,
    services,
  });

  deepStrictEqual(
    network.nodes.lightning.map(n => [n.name, n.status, n.errorMsg]),
    [
      ['alice', 'Started', undefined],
      ['bob', 'Error', 'connect ECONNREFUSED 127.0.0.1:10002'],
    ],
    'Got the node statuses',
  );
});

test('A tapd node gets the state of its container, with no RPC call', async () => {
  const network = makeNetwork();
  const tapd = addTapd(network);

  const services = fakeServices({});

  const running = folderOf(() =>
    psLine({name: 'alice-tap', network, state: 'running'}),
  );

  await monitorStartup({
    folder: running.folder,
    network,
    nodes: [tapd],
    services,
  });

  deepStrictEqual(
    [tapd.status, tapd.errorMsg, running.calls.length],
    ['Started', undefined, 1],
    'A running container gives the Started status',
  );

  const exited = folderOf(() =>
    psLine({name: 'alice-tap', network, state: 'exited'}),
  );

  await monitorStartup({
    folder: exited.folder,
    network,
    nodes: [tapd],
    services,
  });

  deepStrictEqual(
    [tapd.status, tapd.errorMsg],
    ['Error', 'The container polarln-n1-alice-tap is exited'],
    'An exited container gives the Error status',
  );

  const none = folderOf(() => '');

  await monitorStartup({folder: none.folder, network, nodes: [tapd], services});

  deepStrictEqual(
    [tapd.status, tapd.errorMsg],
    ['Error', 'The container polarln-n1-alice-tap is not there'],
    'A missing container gives the Error status',
  );
});

test('A failed container check gives the error message and details', async () => {
  const network = makeNetwork();
  const tapd = addTapd(network);

  // A different folder uses the container name of the tapd node
  const {folder} = folderOf(() =>
    JSON.stringify([
      'polarln-n1-alice-tap',
      'running',
      'polarln-network-1',
      '/x',
    ]),
  );

  await monitorStartup({
    folder,
    network,
    nodes: [tapd],
    services: fakeServices({}),
  });

  deepStrictEqual(
    [tapd.status, tapd.errorMsg],
    [
      'Error',
      'ContainerNameInUse: {"container":"polarln-n1-alice-tap",' +
        '"project":"polarln-network-1","workingDir":"/x"}',
    ],
    'The error message has the details of the PolarError',
  );
});

test('The container check runs after the LND nodes are online', async () => {
  const network = makeNetwork();
  const tapd = addTapd(network);
  const [alice] = network.nodes.lightning;
  const order: string[] = [];

  const services = fakeServices({
    alice: async () => {
      await new Promise(resolve => setTimeout(resolve, 10));

      order.push('alice online');
    },
  });

  const {folder} = folderOf(() => {
    order.push('docker ps');

    return psLine({name: 'alice-tap', network, state: 'running'});
  });

  await monitorStartup({folder, network, nodes: [alice, tapd], services});

  deepStrictEqual(
    [order, alice.status, tapd.status],
    [['alice online', 'docker ps'], 'Started', 'Started'],
    'The tapd node gets its status after the LND node is online',
  );
});

test('A litd node gets the LND probe and joins the peer connections', async () => {
  const network = makeNetwork();
  const [alice, bob] = network.nodes.lightning;

  // bob is a litd node, with an integrated lnd daemon
  Object.assign(bob, {implementation: 'litd', lndName: 'bob'});

  const probed: string[] = [];
  const connected: string[] = [];

  const services: StartupServices = {
    ...fakeServices({}),
    lnd: {
      connectPeers: async ({node}) => {
        connected.push(node.name);
      },
      getInfo: async node => ({
        alias: node.name,
        blockHeight: 1,
        numActiveChannels: 0,
        numInactiveChannels: 0,
        numPendingChannels: 0,
        pubkey: `${node.name}-key`,
        rpcUrl: `${node.name}-key@${node.name}:9735`,
        syncedToChain: true,
      }),
      waitUntilOnline: async node => {
        probed.push(node.name);
      },
    },
  };

  // The docker runner throws, so no container check runs
  const {folder} = folderOf();

  await monitorStartup({folder, network, nodes: [alice, bob], services});

  deepStrictEqual(
    [probed, connected.sort(), bob.status],
    [['alice', 'bob'], ['alice', 'bob'], 'Started'],
    'The litd node got the lnd probe and the peer connections',
  );
});
