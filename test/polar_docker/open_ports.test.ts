import {deepStrictEqual} from 'node:assert/strict';
import {createServer} from 'node:net';
import type {Server} from 'node:net';
import test from 'node:test';

import type {LndNode} from '../../src/index.js';
import type {TapdNode} from '../../src/index.js';

import newNetwork from '../../src/polar_docker/new_network.js';
import openPorts from '../../src/polar_docker/open_ports.js';
import {openPortRange} from '../../src/polar_docker/open_ports.js';
import planNetwork from '../../src/polar_docker/plan_network.js';

// Hold a free port that the system picks
const holdPort = async () => {
  const server: Server = createServer();

  await new Promise<void>(resolve => server.listen(0, resolve));

  const {port} = server.address() as {port: number};

  return {close: () => new Promise(resolve => server.close(resolve)), port};
};

test('A port in use moves to the next free port', async () => {
  const held = await holdPort();

  try {
    const [first, second, zero] = await openPortRange([
      held.port,
      held.port,
      0,
    ]);

    deepStrictEqual(first > held.port, true, 'The held port moves up');
    deepStrictEqual(second > first, true, 'The next port stays above');
    deepStrictEqual(zero, 0, 'A 0 port stays 0');
  } finally {
    await held.close();
  }
});

test('Only the nodes that do not run get new ports', async () => {
  const held = await holdPort();

  const network = newNetwork({
    dataDir: '/data',
    description: '',
    id: 1,
    name: 'n',
    plan: planNetwork({}),
  });

  const [backend] = network.nodes.bitcoin;
  const [alice, bob] = network.nodes.lightning as LndNode[];

  backend.ports = {p2p: 0, rpc: 0, zmqBlock: 0, zmqTx: 0};
  alice.ports.grpc = held.port;
  alice.ports.p2p = 0;
  alice.ports.rest = 0;
  bob.status = 'Started';

  try {
    const ports = await openPorts({network});

    deepStrictEqual(Object.keys(ports || {}), ['alice'], 'Only alice moves');
    deepStrictEqual(ports?.alice.grpc !== held.port, true, 'Got a new port');
  } finally {
    await held.close();
  }

  bob.status = 'Stopped';
  network.nodes.bitcoin = [];
  network.nodes.lightning = [];

  deepStrictEqual(await openPorts({network}), undefined, 'No change');
});

test('The check covers each port of each node kind', async () => {
  const held = await holdPort();

  const network = newNetwork({
    dataDir: '/data',
    description: '',
    id: 1,
    name: 'n',
    plan: planNetwork({}),
  });

  const {bitcoin, lightning} = network.nodes;

  [...bitcoin, ...lightning].forEach(node => {
    const ports = node.ports as {[port: string]: number};

    Object.keys(ports).forEach(port => (ports[port] = 0));
  });

  const tapd: TapdNode = {
    id: 0,
    networkId: 1,
    name: 'alice-tap',
    type: 'tap',
    implementation: 'tapd',
    version: '0.7.0-alpha',
    status: 'Stopped',
    lndName: 'alice',
    paths: {adminMacaroon: '', tlsCert: ''},
    ports: {grpc: 0, rest: held.port},
    docker: {command: '', image: ''},
  };

  network.nodes.tap.push(tapd);

  try {
    const ports = await openPorts({network});

    deepStrictEqual(
      [Object.keys(ports || {}), Object.keys(ports?.['alice-tap'] || {})],
      [['alice-tap'], ['rest']],
      'The tapd rest port moves',
    );

    // The container of the node runs, so the node holds its own port
    const running = await openPorts({
      isRunning: node => node.name === 'alice-tap',
      network,
    });

    deepStrictEqual(running, undefined, 'A node that runs keeps its ports');
  } finally {
    await held.close();
  }
});
