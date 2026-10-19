import {deepStrictEqual} from 'node:assert/strict';
import {equal} from 'node:assert/strict';
import {throws} from 'node:assert/strict';
import test from 'node:test';

import composeFile from '../../src/polar_docker/compose_file.js';
import newNetwork from '../../src/polar_docker/new_network.js';
import planNetwork from '../../src/polar_docker/plan_network.js';
import type {Network} from '../../src/index.js';

const makeNetwork = () => {
  const plan = planNetwork({});

  return newNetwork({
    dataDir: '/data',
    description: '',
    id: 2,
    name: 'n',
    plan,
  });
};

const environment = {GROUPID: '${GROUPID:-1000}', USERID: '${USERID:-1000}'};

test('The compose file has the Polar services with polarln names', () => {
  const {file} = composeFile({network: makeNetwork()});

  const content = JSON.parse(file);

  equal(content.name, 'polarln-network-2', 'Got project name');

  deepStrictEqual(Object.keys(content.services), ['backend1', 'alice', 'bob']);

  const {alice, backend1} = content.services;

  deepStrictEqual(
    {...backend1, command: undefined},
    {
      command: undefined,
      container_name: 'polarln-n2-backend1',
      environment,
      expose: ['18443', '18444', '28334', '28335'],
      hostname: 'backend1',
      image: 'polarlightning/bitcoind:30.0',
      ports: ['18443:18443', '19444:18444', '28334:28334', '29335:28335'],
      stop_grace_period: '5m',
      volumes: ['./volumes/bitcoind/backend1:/home/bitcoin/.bitcoin'],
    },
    'Got bitcoind service',
  );

  equal(
    backend1.command.startsWith(
      'bitcoind -server=1 -regtest=1 -rpcauth=polaruser:',
    ),
    true,
    'Got bitcoind command with the RPC user',
  );

  deepStrictEqual(
    {...alice, command: undefined},
    {
      command: undefined,
      container_name: 'polarln-n2-alice',
      environment,
      expose: ['8080', '10009', '9735'],
      hostname: 'alice',
      image: 'polarlightning/lnd:0.20.0-beta',
      ports: ['8081:8080', '10001:10009', '9735:9735'],
      restart: 'always',
      stop_grace_period: '30s',
      volumes: ['./volumes/lnd/alice:/home/lnd/.lnd'],
    },
    'Got LND service',
  );

  const flags = alice.command.split(' ');

  deepStrictEqual(
    flags.filter((n: string) =>
      /alias|tlsextradomain|rpchost|rpcuser|zmq/.test(n),
    ),
    [
      '--alias=alice',
      '--tlsextradomain=alice',
      '--tlsextradomain=polarln-n2-alice',
      '--tlsextradomain=host.docker.internal',
      '--bitcoind.rpchost=polarln-n2-backend1',
      '--bitcoind.rpcuser=polaruser',
      '--bitcoind.zmqpubrawblock=tcp://polarln-n2-backend1:28334',
      '--bitcoind.zmqpubrawtx=tcp://polarln-n2-backend1:28335',
    ],
    'Got LND command with the node and backend names',
  );
});

test('A custom image and command replace the defaults', () => {
  const network = makeNetwork();

  network.nodes.lightning[0].docker = {
    command: 'lnd --alias={{name}}',
    image: 'my/lnd',
  };

  const {alice} = JSON.parse(composeFile({network}).file).services;

  deepStrictEqual(
    [alice.image, alice.command],
    ['my/lnd', 'lnd --alias=alice'],
  );
});

test('The compose file does not support other nodes yet', () => {
  const network = makeNetwork();

  network.nodes.tap.push({} as Network['nodes']['tap'][number]);

  throws(
    () => composeFile({network}),
    new Error('polarDocker does not support tapd nodes yet'),
  );
});
