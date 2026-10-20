import {deepStrictEqual} from 'node:assert/strict';
import {equal} from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {mkdtemp} from 'node:fs/promises';
import {readFile} from 'node:fs/promises';
import {rm} from 'node:fs/promises';
import {writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname} from 'node:path';
import {join} from 'node:path';
import test from 'node:test';

import {addNode} from '../../src/index.js';
import {createNetwork} from '../../src/index.js';
import {getDefaultNodeCommand} from '../../src/index.js';
import {listNetworks} from '../../src/index.js';
import {listNodeVersions} from '../../src/index.js';
import {polarDocker} from '../../src/index.js';
import {removeNode} from '../../src/index.js';
import {renameNode} from '../../src/index.js';
import {restartNode} from '../../src/index.js';
import {setLightningBackend} from '../../src/index.js';
import {startNode} from '../../src/index.js';
import {stopNode} from '../../src/index.js';
import {updateNodeCommand} from '../../src/index.js';
import type {LndNode} from '../../src/index.js';
import type {Network} from '../../src/index.js';
import type {PolarDocker} from '../../src/index.js';
import makePolarDocker from '../../src/polar_docker/make_polar_docker.js';
import {assertPolarLoadable} from '../fixtures/assert_polar_loadable.js';
import {fakeDockerRunner} from '../fixtures/fake_docker_runner.js';
import {rejection} from '../fixtures/rejection.js';

const withDataDir = async (use: (dataDir: string) => Promise<void>) => {
  const dataDir = await mkdtemp(join(tmpdir(), 'polarln-docker-'));

  try {
    await use(dataDir);
  } finally {
    await rm(dataDir, {force: true, recursive: true});
  }
};

const firstNetwork = async (polar: PolarDocker): Promise<Network> =>
  (await listNetworks({polar})).networks[0];

const networksFile = (dataDir: string) =>
  join(dataDir, 'networks', 'networks.json');

// Get the Polar chart of the first network
const firstChart = async (dataDir: string) => {
  const file = JSON.parse(await readFile(networksFile(dataDir), 'utf8'));

  return file.charts['1'];
};

const composeServices = async (network: Network) => {
  const file = await readFile(join(network.path, 'docker-compose.yml'), 'utf8');

  return JSON.parse(file).services as {[name: string]: {command: string}};
};

test('Nodes can be added to a stopped network', () => {
  return withDataDir(async dataDir => {
    const {polar} = polarDocker({dataDir});

    await createNetwork({name: 'n', polar});

    const bitcoind = await addNode({
      implementation: 'bitcoind',
      networkId: 1,
      polar,
      version: '27.0',
    });

    deepStrictEqual(
      [bitcoind.success, bitcoind.message],
      [true, 'Bitcoin Core node "backend2" added to network "n" successfully'],
      'Got bitcoind node message',
    );

    deepStrictEqual(
      [bitcoind.node.name, bitcoind.node.status, bitcoind.node.version],
      ['backend2', 'Stopped', '27.0'],
      'Got bitcoind node',
    );

    const lnd = await addNode({implementation: 'LND', networkId: 1, polar});

    deepStrictEqual(
      [lnd.message, lnd.node.name, lnd.node.version],
      [
        'LND node "carol" added to network "n" successfully',
        'carol',
        '0.20.0-beta',
      ],
      'Got LND node with the latest version',
    );

    const network = await firstNetwork(polar);

    deepStrictEqual(
      network.nodes.bitcoin.map(n => n.peers),
      [['backend2'], ['backend1']],
      'The new bitcoind node and the last node are peers',
    );

    deepStrictEqual(
      Object.keys(await composeServices(network)),
      ['backend1', 'backend2', 'alice', 'bob', 'carol'],
      'The compose file has the new nodes',
    );

    await assertPolarLoadable(networksFile(dataDir));
  });
});

test('Nodes can be removed from a stopped network', () => {
  return withDataDir(async dataDir => {
    const {polar} = polarDocker({dataDir});

    await createNetwork({
      name: 'n',
      nodes: [
        {count: 3, implementation: 'bitcoind'},
        {count: 2, implementation: 'LND'},
      ],
      polar,
    });

    const before = await firstNetwork(polar);
    const bobPath = dirname(
      (before.nodes.lightning[1] as LndNode).paths.tlsCert,
    );

    await mkdir(bobPath, {recursive: true});

    const removed = await removeNode({networkId: 1, nodeName: 'bob', polar});

    deepStrictEqual(
      removed,
      {
        success: true,
        message: 'Lightning node "bob" removed from network "n" successfully',
      },
      'Got removed lightning node',
    );

    equal(existsSync(bobPath), false, 'The node data is removed');

    await removeNode({networkId: 1, nodeName: 'backend2', polar});

    const network = await firstNetwork(polar);

    deepStrictEqual(
      network.nodes.bitcoin.map(n => [n.name, n.peers]),
      [
        ['backend1', ['backend3']],
        ['backend3', ['backend1']],
      ],
      'The nodes before and after the removed node are peers',
    );

    deepStrictEqual(
      network.nodes.lightning.map(n => [n.name, n.backendName]),
      [['alice', 'backend1']],
      'Got the other lightning node',
    );

    deepStrictEqual(
      Object.keys(await composeServices(network)),
      ['backend1', 'backend3', 'alice'],
      'The compose file does not have the removed nodes',
    );

    const chart = await firstChart(dataDir);

    deepStrictEqual(
      [Object.keys(chart.nodes), Object.keys(chart.links)],
      [
        ['backend1', 'backend3', 'alice'],
        ['alice-backend1', 'backend1-backend3'],
      ],
      'The chart does not have the removed nodes, and has the new peer link',
    );

    await assertPolarLoadable(networksFile(dataDir));

    await removeNode({networkId: 1, nodeName: 'backend1', polar});

    deepStrictEqual(
      (await firstNetwork(polar)).nodes.lightning[0].backendName,
      'backend3',
      'The lightning node moves to a different backend',
    );
  });
});

test('Nodes can be renamed in a stopped network', () => {
  return withDataDir(async dataDir => {
    const {polar} = polarDocker({dataDir});

    await createNetwork({name: 'n', polar});

    const before = await firstNetwork(polar);
    const alice = before.nodes.lightning[0] as LndNode;

    await mkdir(dirname(alice.paths.tlsCert), {recursive: true});
    await writeFile(alice.paths.tlsCert, 'cert');

    // The user moved alice, and alice has a channel to bob
    const file = JSON.parse(await readFile(networksFile(dataDir), 'utf8'));

    file.charts['1'].nodes.alice.position = {x: 7, y: 8};
    file.charts['1'].links.chan = {
      id: 'chan',
      from: {nodeId: 'alice', portId: 'chan'},
      to: {nodeId: 'bob', portId: 'chan'},
      properties: {type: 'open-channel'},
    };

    await writeFile(networksFile(dataDir), JSON.stringify(file, null, 2));

    const renamed = await renameNode({
      networkId: 1,
      newName: 'zed',
      oldName: 'alice',
      polar,
    });

    deepStrictEqual(
      renamed,
      {
        success: true,
        message:
          'Lightning node "alice" renamed to "zed" in network "n" successfully',
      },
      'Got renamed node',
    );

    await renameNode({
      networkId: 1,
      newName: 'chain',
      oldName: 'backend1',
      polar,
    });

    const network = await firstNetwork(polar);
    const zed = network.nodes.lightning[0] as LndNode;

    deepStrictEqual(
      [zed.name, zed.backendName, network.nodes.bitcoin[0].name],
      ['zed', 'chain', 'chain'],
      'Got the new names',
    );

    equal(existsSync(dirname(alice.paths.tlsCert)), false, 'Old dir is moved');
    equal(existsSync(dirname(zed.paths.tlsCert)), true, 'Got new dir');
    equal(existsSync(zed.paths.tlsCert), false, 'The old TLS cert is removed');

    deepStrictEqual(
      Object.keys(await composeServices(network)),
      ['chain', 'zed', 'bob'],
      'The compose file has the new names',
    );

    const chart = await firstChart(dataDir);

    deepStrictEqual(
      [chart.nodes.zed.position, Object.keys(chart.links), chart.links.chan],
      [
        {x: 7, y: 8},
        ['zed-chain', 'bob-chain', 'chan'],
        {
          id: 'chan',
          from: {nodeId: 'zed', portId: 'chan'},
          to: {nodeId: 'bob', portId: 'chan'},
          properties: {type: 'open-channel'},
        },
      ],
      'The chart node keeps its position, and the links get the new names',
    );

    await assertPolarLoadable(networksFile(dataDir));
  });
});

test('Node commands and backends can be changed in a stopped network', () => {
  return withDataDir(async dataDir => {
    const {polar} = polarDocker({dataDir});

    await createNetwork({
      name: 'n',
      nodes: [
        {count: 2, implementation: 'bitcoind'},
        {count: 1, implementation: 'LND'},
      ],
      polar,
    });

    const updated = await updateNodeCommand({
      command: 'lnd --noseedbackup',
      networkId: 1,
      nodeName: 'alice',
      polar,
    });

    deepStrictEqual(
      updated,
      {
        success: true,
        message:
          'Successfully updated custom command for node "alice" in network "n"',
        networkId: 1,
        nodeName: 'alice',
        command: 'lnd --noseedbackup',
      },
      'Got updated command',
    );

    equal(
      (await composeServices(await firstNetwork(polar))).alice.command,
      'lnd --noseedbackup',
      'The compose file has the new command',
    );

    const reset = await updateNodeCommand({
      command: '',
      networkId: 1,
      nodeName: 'alice',
      polar,
    });

    equal(
      reset.message,
      'Successfully reset node "alice" to use default command in network "n"',
      'Got reset message',
    );

    const backend = await setLightningBackend({
      bitcoinNodeName: 'backend2',
      lightningNodeName: 'alice',
      networkId: 1,
      polar,
    });

    deepStrictEqual(
      backend,
      {
        success: true,
        message:
          'Successfully changed backend for Lightning node "alice" to ' +
          'Bitcoin node "backend2" in network "n"',
        networkId: 1,
        lightningNodeName: 'alice',
        bitcoinNodeName: 'backend2',
      },
      'Got new backend',
    );

    const {command} = (await composeServices(await firstNetwork(polar))).alice;

    equal(
      command.includes('--bitcoind.rpchost=polarln-n1-backend2'),
      true,
      'The compose file has the new backend',
    );

    deepStrictEqual(
      Object.keys((await firstChart(dataDir)).links),
      ['backend1-backend2', 'alice-backend2'],
      'The chart link goes to the new backend',
    );

    await assertPolarLoadable(networksFile(dataDir));
  });
});

test('A node with the Error status can be stopped', () => {
  return withDataDir(async dataDir => {
    // The fake docker runner fails each up command
    const {calls, docker} = fakeDockerRunner({
      respond: ({args}) => {
        if (args.includes('up')) {
          throw {code: 1, message: 'Command failed', stderr: 'up failed'};
        }

        return '';
      },
    });

    const {polar} = makePolarDocker({
      dataDir,
      docker,
      env: {},
      home: join(dataDir, 'home'),
    });

    const {network} = await createNetwork({name: 'n', polar});

    const [code, message] = (await rejection(
      startNode({networkId: 1, nodeName: 'alice', polar}),
    )) as [number, string];

    deepStrictEqual([code, message], [503, 'PolarToolFailed'], 'Start fails');

    const alice = (await firstNetwork(polar)).nodes.lightning[0];

    deepStrictEqual(
      [alice.status, alice.errorMsg],
      ['Error', 'up failed'],
      'The node has the Error status',
    );

    const stopped = await stopNode({networkId: 1, nodeName: 'alice', polar});

    deepStrictEqual(
      [stopped.success, stopped.nodeStatus],
      [true, 'Stopped'],
      'The node with the Error status stops',
    );

    deepStrictEqual(
      calls.map(({args}) => args.slice(3)),
      [
        ['stop', 'alice'],
        ['up', '-d', 'alice'],
        ['stop', 'alice'],
      ],
      'Got the docker compose commands',
    );

    equal(
      calls.every(({cwd}) => cwd === network.path),
      true,
      'The commands run in the network directory',
    );
  });
});

test('Node versions and default commands can be listed', async () => {
  const {polar} = polarDocker({dataDir: join(tmpdir(), 'polarln-unused')});

  const all = await listNodeVersions({polar});

  deepStrictEqual(
    [Object.keys(all.versions), all.latest, all.message],
    [
      ['bitcoind', 'LND'],
      {bitcoind: '30.0', LND: '0.20.0-beta'},
      'All supported node versions in Polar',
    ],
    'Got all versions',
  );

  deepStrictEqual(
    all.compatibility,
    {LND: all.compatibility.LND},
    'Only LND has a compatibility list',
  );

  const lnd = await listNodeVersions({implementation: 'LND', polar});

  deepStrictEqual(
    [Object.keys(lnd.versions), lnd.message],
    [['LND'], 'Available versions for LND'],
    'Got LND versions',
  );

  const command = await getDefaultNodeCommand({
    implementation: 'bitcoind',
    polar,
  });

  deepStrictEqual(
    [command.version, command.message, command.command.split('\n')[0]],
    ['30.0', 'Retrieved default command for bitcoind v30.0', 'bitcoind'],
    'Got default command',
  );
});

test('Node tools reject bad arguments as the bridge does', () => {
  return withDataDir(async dataDir => {
    const {polar} = polarDocker({dataDir});

    await createNetwork({name: 'n', polar});

    const tests = [
      {
        error: [404, 'PolarNetworkNotFound', 'Network with ID 9 not found'],
        run: () => addNode({implementation: 'LND', networkId: 9, polar}),
      },
      {
        error: [
          501,
          'PolarToolNotSupported',
          'polarDocker does not support eclair nodes yet',
        ],
        run: () => addNode({implementation: 'eclair', networkId: 1, polar}),
      },
      {
        error: [
          400,
          'PolarRejectedArguments',
          'Cannot remove the only bitcoin node',
        ],
        run: () => removeNode({networkId: 1, nodeName: 'backend1', polar}),
      },
      {
        error: [
          404,
          'PolarNodeNotFound',
          'Node "x" not found in network "n". ' +
            'Available nodes: alice, bob, backend1',
        ],
        run: () => removeNode({networkId: 1, nodeName: 'x', polar}),
      },
      {
        error: [
          400,
          'PolarRejectedArguments',
          'New node name must contain only letters, numbers, hyphens, and ' +
            'underscores',
        ],
        run: () =>
          renameNode({networkId: 1, newName: 'a b', oldName: 'alice', polar}),
      },
      {
        error: [
          503,
          'PolarToolFailed',
          "The node 'alice' is already connected to 'backend1'",
        ],
        run: () =>
          setLightningBackend({
            bitcoinNodeName: 'backend1',
            lightningNodeName: 'alice',
            networkId: 1,
            polar,
          }),
      },
      {
        error: [
          400,
          'PolarRejectedArguments',
          'Cannot stop node "alice". Node is currently Stopped. ' +
            'Only Started nodes can be stopped.',
        ],
        run: () => stopNode({networkId: 1, nodeName: 'alice', polar}),
      },
      {
        error: [
          400,
          'PolarRejectedArguments',
          'Cannot restart node "alice". Node is currently Stopped. ' +
            'Only Started or Error nodes can be restarted.',
        ],
        run: () => restartNode({networkId: 1, nodeName: 'alice', polar}),
      },
      {
        error: [404, 'PolarNodeNotFound', 'Node "x" not found in network "n"'],
        run: () => startNode({networkId: 1, nodeName: 'x', polar}),
      },
      {
        error: [
          400,
          'PolarRejectedArguments',
          'Command is required (use empty string to reset to default)',
        ],
        run: () =>
          updateNodeCommand({
            command: undefined as unknown as string,
            networkId: 1,
            nodeName: 'alice',
            polar,
          }),
      },
      {
        error: [
          501,
          'PolarToolNotSupported',
          'polarDocker does not support tapd nodes yet',
        ],
        run: () => listNodeVersions({implementation: 'tapd', polar}),
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
  });
});
