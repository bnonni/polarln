import {deepStrictEqual} from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {rm} from 'node:fs/promises';
import {writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';

import {getNodeCredentials} from '../../src/index.js';
import type {Network} from '../../src/index.js';
import type {Polar} from '../../src/index.js';
import type {Status} from '../../src/index.js';
import {fakePolar} from '../fixtures/fake_polar.js';
import {rejection} from '../fixtures/rejection.js';

const base64 = (text: string) => Buffer.from(text).toString('base64');
const docker = {command: '', image: ''};

const makeNetwork = (dir: string, status: Status = 'Started'): Network => {
  const common = {docker, networkId: 4, status, version: '1'};

  return {
    autoMineMode: 0,
    id: 4,
    name: 'test',
    nodes: {
      bitcoin: [
        {
          ...common,
          id: 0,
          implementation: 'bitcoind',
          name: 'backend1',
          peers: [],
          ports: {rpc: 18443},
          type: 'bitcoin',
        },
      ],
      lightning: [
        {
          ...common,
          backendName: 'backend1',
          id: 0,
          implementation: 'LND',
          name: 'alice',
          paths: {
            adminMacaroon: join(dir, 'alice.macaroon'),
            invoiceMacaroon: '',
            readonlyMacaroon: '',
            tlsCert: join(dir, 'alice.cert'),
          },
          ports: {grpc: 10001, p2p: 9735, rest: 8081},
          type: 'lightning',
        },
        {
          ...common,
          backendName: 'backend1',
          id: 1,
          implementation: 'litd',
          lndName: 'bob',
          name: 'bob',
          paths: {
            adminMacaroon: join(dir, 'bob-lnd.macaroon'),
            invoiceMacaroon: '',
            litMacaroon: join(dir, 'bob-lit.macaroon'),
            litTlsCert: join(dir, 'bob-lit.cert'),
            readonlyMacaroon: '',
            tapMacaroon: join(dir, 'bob-tap.macaroon'),
            tlsCert: join(dir, 'bob-lnd.cert'),
          },
          ports: {grpc: 10002, p2p: 9736, rest: 8082, web: 8444},
          type: 'lightning',
        },
        {
          ...common,
          backendName: 'backend1',
          id: 2,
          implementation: 'eclair',
          name: 'erin',
          ports: {p2p: 9737, rest: 8283},
          type: 'lightning',
        },
      ],
      tap: [
        {
          ...common,
          id: 0,
          implementation: 'tapd',
          lndName: 'alice',
          name: 'carol',
          paths: {
            adminMacaroon: join(dir, 'carol.macaroon'),
            tlsCert: join(dir, 'carol.cert'),
          },
          ports: {grpc: 12029, rest: 8289},
          type: 'tap',
        },
      ],
    },
    path: dir,
    status,
  };
};

const files = [
  'alice.cert',
  'alice.macaroon',
  'bob-lit.cert',
  'bob-lit.macaroon',
  'bob-lnd.cert',
  'bob-lnd.macaroon',
  'bob-tap.macaroon',
  'carol.cert',
  'carol.macaroon',
];

const withFiles = async (run: (dir: string) => Promise<void>) => {
  const dir = await mkdtemp(join(tmpdir(), 'polarln-'));

  try {
    await Promise.all(files.map(file => writeFile(join(dir, file), file)));

    await run(dir);
  } finally {
    await rm(dir, {force: true, recursive: true});
  }
};

const polarWith = (network: Network) =>
  fakePolar({body: {networks: [network]}});

const credentials = (cert: string, macaroon: string, port: number) => ({
  cert: base64(cert),
  macaroon: base64(macaroon),
  socket: `localhost:${port}`,
});

test('An LND node gives lnd credentials', async () => {
  await withFiles(async dir => {
    const {polar, requests} = polarWith(makeNetwork(dir));

    deepStrictEqual(
      await getNodeCredentials({networkId: 4, nodeName: 'alice', polar}),
      {
        implementation: 'LND',
        lnd: credentials('alice.cert', 'alice.macaroon', 10001),
      },
    );

    deepStrictEqual(
      requests.map(({body}) => body),
      [{arguments: {}, tool: 'list_networks'}],
    );
  });
});

test('A litd node gives litd, lnd, and tapd credentials', async () => {
  await withFiles(async dir => {
    const {polar} = polarWith(makeNetwork(dir));

    deepStrictEqual(
      await getNodeCredentials({networkId: 4, nodeName: 'bob', polar}),
      {
        implementation: 'litd',
        litd: credentials('bob-lit.cert', 'bob-lit.macaroon', 8444),
        lnd: credentials('bob-lnd.cert', 'bob-lnd.macaroon', 10002),
        tapd: credentials('bob-lit.cert', 'bob-tap.macaroon', 8444),
      },
    );
  });
});

test('A tapd node gives tapd credentials', async () => {
  await withFiles(async dir => {
    const {polar} = polarWith(makeNetwork(dir));

    deepStrictEqual(
      await getNodeCredentials({networkId: 4, nodeName: 'carol', polar}),
      {
        implementation: 'tapd',
        tapd: credentials('carol.cert', 'carol.macaroon', 12029),
      },
    );
  });
});

test('A missing credential file is a rejection with the path', async () => {
  await withFiles(async dir => {
    const {polar} = polarWith(makeNetwork(dir));

    await rm(join(dir, 'alice.macaroon'));

    const [code, message, details] = (await rejection(
      getNodeCredentials({networkId: 4, nodeName: 'alice', polar}),
    )) as [number, string, {path: string}];

    deepStrictEqual(
      [code, message, details.path],
      [503, 'FailedToReadNodeCredentialFile', join(dir, 'alice.macaroon')],
    );
  });
});

const network = makeNetwork('/none');
const {polar} = polarWith(network);

const tests = [
  {
    args: {
      networkId: 4,
      nodeName: 'alice',
      polar: undefined as unknown as Polar,
    },
    description: 'A Polar bridge object is expected',
    error: [400, 'ExpectedPolarBridge', {tool: 'list_networks'}],
  },
  {
    args: {networkId: '4' as unknown as number, nodeName: 'alice', polar},
    description: 'A network id is expected',
    error: [400, 'ExpectedNetworkIdToGetNodeCredentials'],
  },
  {
    args: {networkId: 4, nodeName: '', polar},
    description: 'A node name is expected',
    error: [400, 'ExpectedNodeNameToGetNodeCredentials'],
  },
  {
    args: {networkId: 5, nodeName: 'alice', polar},
    description: 'The network must exist',
    error: [404, 'PolarNetworkNotFound', {networkId: 5}],
  },
  {
    args: {networkId: 4, nodeName: 'dave', polar},
    description: 'The node must exist',
    error: [404, 'PolarNodeNotFound', {nodeName: 'dave'}],
  },
  {
    args: {networkId: 4, nodeName: 'backend1', polar},
    description: 'A Bitcoin node has no gRPC credentials',
    error: [
      400,
      'UnsupportedImplementationToGetNodeCredentials',
      {implementation: 'bitcoind'},
    ],
  },
  {
    args: {networkId: 4, nodeName: 'erin', polar},
    description: 'An eclair node has no gRPC credentials',
    error: [
      400,
      'UnsupportedImplementationToGetNodeCredentials',
      {implementation: 'eclair'},
    ],
  },
  {
    args: {
      networkId: 4,
      nodeName: 'alice',
      polar: polarWith(makeNetwork('/none', 'Stopped')).polar,
    },
    description: 'The node must be started',
    error: [
      503,
      'ExpectedStartedNodeToGetNodeCredentials',
      {status: 'Stopped'},
    ],
  },
];

tests.forEach(({args, description, error}) => {
  test(description, async () => {
    deepStrictEqual(await rejection(getNodeCredentials(args)), error);
  });
});
