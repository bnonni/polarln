import {deepStrictEqual} from 'node:assert/strict';
import {equal} from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {mkdtemp} from 'node:fs/promises';
import {readFile} from 'node:fs/promises';
import {rm} from 'node:fs/promises';
import {writeFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import type {AddressInfo} from 'node:net';
import {tmpdir} from 'node:os';
import {dirname} from 'node:path';
import {join} from 'node:path';
import test from 'node:test';

import {closeChannel} from '../../src/index.js';
import {createInvoice} from '../../src/index.js';
import {createNetwork} from '../../src/index.js';
import {depositFunds} from '../../src/index.js';
import {getNodeInfo} from '../../src/index.js';
import {openChannel} from '../../src/index.js';
import {payInvoice} from '../../src/index.js';
import {polarDocker} from '../../src/index.js';
import type {LitdNode} from '../../src/index.js';
import type {LndNode} from '../../src/index.js';
import type {CheckApp} from '../../src/polar_docker/data_folder.js';
import type {LightningChannel} from '../../src/polar_docker/lnd_mappers.js';
import type {LightningNodeInfo} from '../../src/polar_docker/lnd_service.js';
import makePolarDocker from '../../src/polar_docker/make_polar_docker.js';
import newNetwork from '../../src/polar_docker/new_network.js';
import planNetwork from '../../src/polar_docker/plan_network.js';
import {findLndNode} from '../../src/polar_docker/tools/find_node.js';
import {nodeChannels} from '../../src/polar_docker/tools/list_channels.js';
import {fakeDockerRunner} from '../fixtures/fake_docker_runner.js';
import {withPolarHome} from '../fixtures/polar_home.js';
import {rejection} from '../fixtures/rejection.js';

type Item = {[key: string]: any};

// The Polar app does not run, so the guard of the Polar home lets tools run
const appOff: CheckApp = async () => ({runs: false});

// Make a stopped network of backend1, alice (LND), and a litd node bob
const litdNetwork = () => {
  const network = newNetwork({
    dataDir: '/data',
    description: '',
    id: 1,
    name: 'n',
    plan: planNetwork({}),
  });

  const dir = join(network.path, 'volumes', 'litd', 'bob');
  const [, lnd] = network.nodes.lightning;

  const bob: LitdNode = {
    ...lnd,
    implementation: 'litd',
    version: '0.16.0-alpha',
    lndName: 'bob',
    paths: {
      adminMacaroon: join(dir, 'lnd/data/chain/bitcoin/regtest/admin.macaroon'),
      invoiceMacaroon: join(
        dir,
        'lnd/data/chain/bitcoin/regtest/invoice.macaroon',
      ),
      litMacaroon: join(dir, 'lit/regtest/lit.macaroon'),
      litTlsCert: join(dir, 'lit/tls.cert'),
      readonlyMacaroon: join(
        dir,
        'lnd/data/chain/bitcoin/regtest/readonly.macaroon',
      ),
      tapMacaroon: join(dir, 'tapd/data/regtest/admin.macaroon'),
      tlsCert: join(dir, 'lnd/tls.cert'),
    },
    ports: {grpc: 10002, p2p: 9736, rest: 8082, web: 8444},
  };

  network.nodes.lightning = [network.nodes.lightning[0], bob];

  return {bob, network};
};

// Get a free port that nothing listens on
const closedPort = async () => {
  const server = createServer();

  await new Promise<void>(resolve => server.listen(0, resolve));

  const {port} = server.address() as AddressInfo;

  await new Promise<void>(resolve => server.close(() => resolve()));

  return port;
};

test('Lightning tools reject bad arguments as the bridge does', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'polarln-docker-'));

  try {
    const {polar} = polarDocker({dataDir});

    await createNetwork({name: 'n', polar});

    const tests = [
      {
        error: [
          400,
          'PolarRejectedArguments',
          'Cannot open channel between the same node',
        ],
        run: () =>
          openChannel({
            fromNode: 'alice',
            networkId: 1,
            polar,
            sats: 1,
            toNode: 'alice',
          }),
      },
      {
        error: [
          400,
          'PolarRejectedArguments',
          'Channel capacity in sats must be greater than 0',
        ],
        run: () =>
          openChannel({
            fromNode: 'alice',
            networkId: 1,
            polar,
            sats: 0,
            toNode: 'bob',
          }),
      },
      {
        error: [
          404,
          'PolarNodeNotFound',
          'Lightning node "x" not found in network',
        ],
        run: () => getNodeInfo({networkId: 1, nodeName: 'x', polar}),
      },
      {
        error: [400, 'PolarRejectedArguments', 'Channel point is required'],
        run: () =>
          closeChannel({channelPoint: '', networkId: 1, nodeName: 'a', polar}),
      },
      {
        error: [
          400,
          'PolarRejectedArguments',
          'Amount in sats must be greater than 0',
        ],
        run: () => depositFunds({networkId: 1, nodeName: 'a', polar, sats: 0}),
      },
      {
        error: [400, 'PolarRejectedArguments', 'Amount must be greater than 0'],
        run: () =>
          createInvoice({amount: 0, networkId: 1, nodeName: 'a', polar}),
      },
      {
        error: [400, 'PolarRejectedArguments', 'fromNode name is required'],
        run: () =>
          payInvoice({fromNode: '', invoice: 'i', networkId: 1, polar}),
      },
    ];

    for (const {error, run} of tests) {
      const [code, message, details] = (await rejection(run())) as [
        number,
        string,
        {err: string},
      ];

      deepStrictEqual([code, message, details.err], error);
    }
  } finally {
    await rm(dataDir, {force: true, recursive: true});
  }
});

test('An LND tool gets a litd node with its lnd paths and grpc port', () => {
  const {bob, network} = litdNetwork();

  const node = findLndNode({network, nodeName: 'bob'});

  equal(Object.is(node, bob), true, 'Got the litd node');

  deepStrictEqual(
    [node.paths.tlsCert, node.paths.adminMacaroon, node.ports.grpc],
    [
      join(network.path, 'volumes/litd/bob/lnd/tls.cert'),
      join(
        network.path,
        'volumes/litd/bob/lnd/data/chain/bitcoin/regtest/admin.macaroon',
      ),
      10002,
    ],
    'The LND tools use the lnd daemon of the litd node',
  );
});

test('An LND tool gives 501 for the other lightning node kinds', () => {
  return withPolarHome(async ({dataDir, file, home}) => {
    const json = JSON.parse(await readFile(file, 'utf8'));
    const [alice] = json.networks[1].nodes.lightning;

    // Network 2 also gets an eclair node and a c-lightning node
    json.networks[1].nodes.lightning.push(
      {...alice, id: 2, name: 'carol', implementation: 'c-lightning'},
      {...alice, id: 3, name: 'dave', implementation: 'eclair'},
    );

    await writeFile(file, JSON.stringify(json, null, 2));

    const {calls, docker} = fakeDockerRunner();

    const {polar} = makePolarDocker({
      checkApp: appOff,
      dataDir,
      docker,
      env: {},
      home,
    });

    const tests = [
      {
        error: [
          501,
          'PolarToolNotSupported',
          'polarDocker does not support c-lightning nodes yet',
        ],
        nodeName: 'carol',
        networkId: 2,
      },
      {
        error: [
          501,
          'PolarToolNotSupported',
          'polarDocker does not support eclair nodes yet',
        ],
        nodeName: 'dave',
        networkId: 2,
      },
      {
        // A tapd node is not a lightning node, as in Polar
        error: [
          404,
          'PolarNodeNotFound',
          'Lightning node "alice-tap" not found in network',
        ],
        nodeName: 'alice-tap',
        networkId: 1,
      },
    ];

    // A lightning node also gives the address of get_new_bitcoin_address
    const tools = ['get_node_info', 'get_new_bitcoin_address'];

    for (const tool of tools) {
      for (const {error, networkId, nodeName} of tests) {
        const [code, message, details] = (await rejection(
          polar.execute(tool, {networkId, nodeName}),
        )) as [number, string, {err: string}];

        deepStrictEqual(
          [code, message, details.err],
          error,
          `${tool} on ${nodeName} fails`,
        );
      }
    }

    deepStrictEqual(calls, [], 'No docker command ran');
  });
});

test('A stopped litd node gives 503 for the lnd tools, not 501', () => {
  return withPolarHome(async ({dataDir, file, home}) => {
    const port = await closedPort();
    const json = JSON.parse(await readFile(file, 'utf8'));
    const bob = json.networks[1].nodes.lightning[1] as Item;

    // No node listens on the grpc port of bob
    bob.ports.grpc = port;

    await writeFile(file, JSON.stringify(json, null, 2));

    await mkdir(dirname(bob.paths.adminMacaroon), {recursive: true});
    await writeFile(bob.paths.adminMacaroon, 'fixture macaroon');

    const {polar} = makePolarDocker({
      checkApp: appOff,
      dataDir,
      docker: fakeDockerRunner().docker,
      env: {},
      home,
    });

    for (const tool of ['get_node_info', 'get_new_bitcoin_address']) {
      const [code, message, details] = (await rejection(
        polar.execute(tool, {networkId: 2, nodeName: 'bob'}),
      )) as [number, string, {err: string}];

      deepStrictEqual(
        [code, message, details.err.includes(`${port}`)],
        [503, 'PolarToolFailed', true],
        `${tool} connects to the lnd grpc port of the litd node`,
      );
    }
  });
});

test('A channel of a litd peer is in the channel list', async () => {
  const {network} = litdNetwork();

  const [alice, bob] = network.nodes.lightning as LndNode[];

  const channel = (pubkey: string): LightningChannel => ({
    assets: [],
    capacity: '1000',
    channelPoint: 'txid:0',
    isPrivate: false,
    localBalance: '700',
    pending: false,
    pubkey,
    remoteBalance: '300',
    status: 'Open',
    uniqueId: 'txid-0',
  });

  // bob opened a channel to alice, and only bob lists it
  const services = {
    getChannels: async (node: LndNode) =>
      node.name === 'bob' ? [channel('alice-key')] : [],
    getInfo: async (node: LndNode) =>
      ({pubkey: `${node.name}-key`}) as LightningNodeInfo,
  };

  deepStrictEqual(
    await nodeChannels({network, node: alice, services}),
    [{...channel('bob-key'), localBalance: '300', remoteBalance: '700'}],
    'alice sees the channel of the litd node bob',
  );

  deepStrictEqual(
    await nodeChannels({network, node: bob, services}),
    [channel('alice-key')],
    'The litd node bob lists its own channel',
  );
});
