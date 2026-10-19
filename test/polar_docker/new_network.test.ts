import {deepStrictEqual} from 'node:assert/strict';
import {throws} from 'node:assert/strict';
import test from 'node:test';

import {addLndNode} from '../../src/polar_docker/create_nodes.js';
import newNetwork from '../../src/polar_docker/new_network.js';
import planNetwork from '../../src/polar_docker/plan_network.js';

const dataDir = '/data';

const makeNetwork = (nodes?: Parameters<typeof planNetwork>[0]['nodes']) => {
  const plan = planNetwork({nodes});

  return newNetwork({dataDir, description: 'd', id: 3, name: 'n', plan});
};

test('A new network has Polar names, ports, paths, and peers', () => {
  const network = makeNetwork([
    {count: 2, implementation: 'bitcoind'},
    {count: 3, implementation: 'LND'},
  ]);

  const path = '/data/networks/3';
  const docker = {command: '', image: ''};

  deepStrictEqual(
    {...network, nodes: {}},
    {
      autoMineMode: 0,
      description: 'd',
      id: 3,
      manualMineCount: 6,
      name: 'n',
      nodes: {},
      path,
      status: 'Stopped',
    },
    'Got network',
  );

  deepStrictEqual(
    network.nodes.bitcoin,
    [0, 1].map(id => ({
      docker,
      id,
      implementation: 'bitcoind',
      name: `backend${id + 1}`,
      networkId: 3,
      peers: [id === 0 ? 'backend2' : 'backend1'],
      ports: {
        p2p: 19444 + id,
        rpc: 18443 + id,
        zmqBlock: 28334 + id,
        zmqTx: 29335 + id,
      },
      status: 'Stopped',
      type: 'bitcoin',
      version: '30.0',
    })),
    'Got bitcoind nodes',
  );

  const regtest = `${path}/volumes/lnd/alice/data/chain/bitcoin/regtest`;

  deepStrictEqual(
    network.nodes.lightning[0],
    {
      backendName: 'backend1',
      docker,
      id: 0,
      implementation: 'LND',
      name: 'alice',
      networkId: 3,
      paths: {
        adminMacaroon: `${regtest}/admin.macaroon`,
        invoiceMacaroon: `${regtest}/invoice.macaroon`,
        readonlyMacaroon: `${regtest}/readonly.macaroon`,
        tlsCert: `${path}/volumes/lnd/alice/tls.cert`,
      },
      ports: {grpc: 10001, p2p: 9735, rest: 8081},
      status: 'Stopped',
      type: 'lightning',
      version: '0.20.0-beta',
    },
    'Got LND node',
  );

  deepStrictEqual(
    network.nodes.lightning.map(n => [n.name, n.backendName, n.ports]),
    [
      ['alice', 'backend1', {grpc: 10001, p2p: 9735, rest: 8081}],
      ['bob', 'backend2', {grpc: 10002, p2p: 9736, rest: 8082}],
      ['carol', 'backend1', {grpc: 10003, p2p: 9737, rest: 8083}],
    ],
    'The LND nodes use the bitcoind nodes in turn',
  );

  deepStrictEqual(network.nodes.tap, [], 'Got no tap nodes');
});

test('An old LND node uses only a compatible bitcoind node', () => {
  const network = makeNetwork([
    {implementation: 'bitcoind'},
    {implementation: 'bitcoind', version: '27.0'},
    {implementation: 'LND'},
    {implementation: 'LND', version: '0.18.3-beta'},
  ]);

  deepStrictEqual(
    network.nodes.bitcoin.map(n => [n.name, n.version]),
    [
      ['backend1', '30.0'],
      ['backend2', '27.0'],
    ],
    'The base bitcoind node comes first',
  );

  deepStrictEqual(
    network.nodes.lightning.map(n => [n.name, n.version, n.backendName]),
    [
      ['alice', '0.20.0-beta', 'backend1'],
      ['bob', '0.18.3-beta', 'backend2'],
    ],
    'Got backends',
  );
});

test('An LND node needs a compatible bitcoind node', () => {
  const network = makeNetwork([{implementation: 'bitcoind'}]);

  throws(
    () => addLndNode({network, version: '0.18.3-beta'}),
    new Error(
      'This network does not contain a Bitcoin Core v27.0 (or lower) node ' +
        'which is required for LND v0.18.3-beta',
    ),
    'Got error',
  );
});
