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
