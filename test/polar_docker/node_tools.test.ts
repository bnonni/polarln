import {deepStrictEqual} from 'node:assert/strict';
import {equal} from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFileSync} from 'node:fs';
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
import type {CheckApp} from '../../src/polar_docker/data_folder.js';
import makePolarDocker from '../../src/polar_docker/make_polar_docker.js';
import {assertPolarLoadable} from '../fixtures/assert_polar_loadable.js';
import {fakeDockerRunner} from '../fixtures/fake_docker_runner.js';
import {withPolarHome} from '../fixtures/polar_home.js';
import {rejection} from '../fixtures/rejection.js';
import {snapshot} from '../fixtures/snapshot.js';

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
    // The rename looks for containers of the network, and there are none
    const {calls, docker} = fakeDockerRunner();

    const {polar} = makePolarDocker({
      dataDir,
      docker,
      env: {},
      home: join(dataDir, 'home'),
    });

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

    deepStrictEqual(
      calls.map(({args}) => args.slice(0, 2)),
      [
        ['ps', '-a'],
        ['ps', '-a'],
      ],
      'Each rename looked for containers, and no compose command ran',
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

    const compose = calls.filter(({args}) => args[0] === 'compose');

    deepStrictEqual(
      calls.map(({args}) => (args[0] === 'ps' ? 'ps' : args.slice(3))),
      ['ps', ['stop', 'alice'], ['up', '-d', 'alice'], 'ps', ['stop', 'alice']],
      'Got the container checks and the docker compose commands',
    );

    equal(
      compose.every(({cwd}) => cwd === network.path),
      true,
      'The compose commands run in the network directory',
    );
  });
});

test('A rename stops a network with a container that runs', () => {
  return withDataDir(async dataDir => {
    const composeAtDown: string[] = [];

    let path = '';

    // The file has the Stopped status, but the container of alice runs
    const {calls, docker} = fakeDockerRunner({
      respond: ({args}) => {
        if (args[0] === 'ps') {
          return JSON.stringify([
            'polarln-n1-alice',
            'running',
            'polarln-network-1',
            path,
          ]);
        }

        if (args[3] === 'down') {
          composeAtDown.push(
            readFileSync(join(path, 'docker-compose.yml'), 'utf8'),
          );
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

    path = network.path;

    await renameNode({networkId: 1, newName: 'zed', oldName: 'alice', polar});

    deepStrictEqual(
      calls.map(({args}) => (args[0] === 'ps' ? 'ps' : args.slice(3))),
      ['ps', 'ps', ['down']],
      'The network stopped, and it did not start again',
    );

    deepStrictEqual(
      composeAtDown.map(file => Object.keys(JSON.parse(file).services)),
      [['backend1', 'alice', 'bob']],
      'The stop used the compose file with the old name',
    );

    deepStrictEqual(
      Object.keys(await composeServices(await firstNetwork(polar))),
      ['backend1', 'zed', 'bob'],
      'The compose file has the new name',
    );
  });
});

test('Node tools do not change a network folder outside the data folder', () => {
  return withDataDir(async dataDir => {
    const {calls, docker} = fakeDockerRunner();

    const {polar} = makePolarDocker({
      dataDir,
      docker,
      env: {},
      home: join(dataDir, 'home'),
    });

    await createNetwork({name: 'n', polar});

    await addNode({implementation: 'bitcoind', networkId: 1, polar});

    // A copied data folder has the network folders of the original folder
    const outside = join(dataDir, 'original', 'networks', '1');
    const cert = join(outside, 'volumes', 'lnd', 'alice', 'tls.cert');

    await mkdir(dirname(cert), {recursive: true});
    await writeFile(cert, 'cert');

    const json = JSON.parse(await readFile(networksFile(dataDir), 'utf8'));

    json.networks[0].path = outside;

    await writeFile(networksFile(dataDir), JSON.stringify(json, null, 2));

    const before = await readFile(networksFile(dataDir), 'utf8');

    const tools = [
      {args: {implementation: 'LND', networkId: 1}, tool: 'add_node'},
      {args: {networkId: 1, nodeName: 'bob'}, tool: 'remove_node'},
      {
        args: {networkId: 1, newName: 'zed', oldName: 'alice'},
        tool: 'rename_node',
      },
      {
        args: {command: 'lnd', networkId: 1, nodeName: 'alice'},
        tool: 'update_node_command',
      },
      {
        args: {
          bitcoinNodeName: 'backend2',
          lightningNodeName: 'alice',
          networkId: 1,
        },
        tool: 'set_lightning_backend',
      },
      {args: {networkId: 1, nodeName: 'alice'}, tool: 'start_node'},
    ];

    for (const {args, tool} of tools) {
      deepStrictEqual(
        await rejection(polar.execute(tool, args)),
        [
          409,
          'NetworkPathOutsideDataFolder',
          {
            expected: join(dataDir, 'networks', '1'),
            networkId: 1,
            path: outside,
          },
        ],
        `${tool} gives the error`,
      );
    }

    deepStrictEqual(calls, [], 'No docker command ran');

    deepStrictEqual(
      [await readFile(networksFile(dataDir), 'utf8'), existsSync(cert)],
      [before, true],
      'The file and the TLS cert are the same',
    );
  });
});

test('A rename does not delete a TLS cert outside the network folder', () => {
  return withDataDir(async dataDir => {
    const {calls, docker} = fakeDockerRunner();

    const {polar} = makePolarDocker({
      dataDir,
      docker,
      env: {},
      home: join(dataDir, 'home'),
    });

    const {network} = await createNetwork({name: 'n', polar});

    const alice = network.nodes.lightning[0] as LndNode;
    const cert = join(dataDir, 'original', 'tls.cert');

    await mkdir(dirname(alice.paths.tlsCert), {recursive: true});
    await mkdir(dirname(cert), {recursive: true});
    await writeFile(cert, 'cert');

    const json = JSON.parse(await readFile(networksFile(dataDir), 'utf8'));

    json.networks[0].nodes.lightning[0].paths.tlsCert = cert;

    await writeFile(networksFile(dataDir), JSON.stringify(json, null, 2));

    const before = await readFile(networksFile(dataDir), 'utf8');

    deepStrictEqual(
      await rejection(
        renameNode({networkId: 1, newName: 'zed', oldName: 'alice', polar}),
      ),
      [
        409,
        'NetworkPathOutsideDataFolder',
        {expected: network.path, networkId: 1, path: cert},
      ],
      'Got the error',
    );

    deepStrictEqual(
      [
        calls,
        await readFile(networksFile(dataDir), 'utf8'),
        existsSync(cert),
        existsSync(dirname(alice.paths.tlsCert)),
      ],
      [[], before, true, true],
      'The file, the TLS cert, and the node folder are the same',
    );
  });
});

// The Polar app does not run, so the guard of the Polar home lets tools run
const appOff: CheckApp = async () => ({runs: false});

test('Node tools do not change a network that a new compose file breaks', () => {
  return withPolarHome(async ({dataDir, file, home}) => {
    const path = (id: number) => join(dataDir, 'networks', `${id}`);

    // The services of the fixture compose files
    const services: {[path: string]: string[]} = {
      [path(1)]: ['backend1', 'alice', 'alice-tap'],
      [path(2)]: ['backend1', 'alice', 'bob'],
      [path(3)]: ['backend1', 'alice', 'electrs'],
    };

    // The fake docker runner answers only a compose config command
    const {calls, docker} = fakeDockerRunner({
      respond: ({args, cwd}) => {
        if (args[3] !== 'config') {
          throw new Error('UnexpectedDockerCommand');
        }

        return services[cwd as string].join('\n');
      },
    });

    const {polar} = makePolarDocker({
      checkApp: appOff,
      dataDir,
      docker,
      env: {},
      home,
    });

    const tools = (networkId: number) => [
      {args: {implementation: 'LND', networkId}, tool: 'add_node'},
      {args: {networkId, nodeName: 'alice'}, tool: 'remove_node'},
      {
        args: {networkId, newName: 'zed', oldName: 'alice'},
        tool: 'rename_node',
      },
      {
        args: {command: 'lnd', networkId, nodeName: 'alice'},
        tool: 'update_node_command',
      },
      {
        args: {
          bitcoinNodeName: 'backend1',
          lightningNodeName: 'alice',
          networkId,
        },
        tool: 'set_lightning_backend',
      },
    ];

    const notSupported = (kind: string, tool: string) => [
      501,
      'PolarToolNotSupported',
      {err: `polarDocker does not support ${kind} nodes yet`, tool},
    ];

    const errors = [
      {error: (tool: string) => notSupported('tapd', tool), networkId: 1},
      {error: (tool: string) => notSupported('litd', tool), networkId: 2},
      {
        error: () => [
          409,
          'ComposeFileHasOtherServices',
          {
            networkId: 3,
            path: join(path(3), 'docker-compose.yml'),
            services: ['electrs'],
          },
        ],
        networkId: 3,
      },
    ];

    const before = await snapshot(home);

    for (const {error, networkId} of errors) {
      for (const {args, tool} of tools(networkId)) {
        deepStrictEqual(
          await rejection(polar.execute(tool, args)),
          error(tool),
          `${tool} on network ${networkId} gives the error`,
        );
      }
    }

    deepStrictEqual(await snapshot(home), before, 'The files are the same');

    deepStrictEqual(
      [
        existsSync(file),
        existsSync(join(path(1), 'volumes', 'lnd', 'alice', 'tls.cert')),
      ],
      [true, true],
      'The networks file and the TLS cert are there',
    );

    // As in Polar, compose runs in the network folder with no -f option
    const config = {
      args: ['compose', '-p', 'polar-network-3', 'config', '--services'],
      cwd: path(3),
    };

    deepStrictEqual(
      calls,
      [config, config, config, config, config],
      'Only the compose config command of network 3 ran',
    );
  });
});

test('The compose check reads a compose file of polarDocker itself', () => {
  return withDataDir(async dataDir => {
    const {calls, docker} = fakeDockerRunner({respond: () => 'backend1\nx'});

    const {polar} = makePolarDocker({
      dataDir,
      docker,
      env: {},
      home: join(dataDir, 'home'),
    });

    const {network} = await createNetwork({name: 'n', polar});

    const path = join(network.path, 'docker-compose.yml');
    const json = JSON.parse(await readFile(path, 'utf8'));

    // A compose file with no service for alice and an added service
    const {alice: _alice, ...services} = json.services;

    await writeFile(
      path,
      JSON.stringify({...json, services: {...services, x: {}}}),
    );

    const update = () =>
      polar.execute('update_node_command', {
        command: 'lnd',
        networkId: 1,
        nodeName: 'alice',
      });

    const otherServices = [
      409,
      'ComposeFileHasOtherServices',
      {networkId: 1, path, services: ['x']},
    ];

    deepStrictEqual(await rejection(update()), otherServices, 'Got the error');
    equal(calls.length, 0, 'The check read the JSON file');

    // A compose file with other keys goes to docker compose
    await writeFile(path, JSON.stringify({...json, volumes: {}}));

    deepStrictEqual(await rejection(update()), otherServices, 'Got the error');

    deepStrictEqual(
      calls.map(({args}) => args.slice(3)),
      [['config', '--services']],
      'The check ran docker compose config',
    );

    // Docker compose also reads an override file, so its services count
    await writeFile(path, JSON.stringify(json));

    const override = join(network.path, 'docker-compose.override.yml');

    await writeFile(override, 'services:\n  x:\n    image: x\n');

    deepStrictEqual(await rejection(update()), otherServices, 'Got the error');

    deepStrictEqual(
      calls.map(({args}) => args.slice(3)),
      [
        ['config', '--services'],
        ['config', '--services'],
      ],
      'The check ran docker compose config for the override file',
    );

    await rm(override);

    // A compose file with no service for a node gets the service
    await writeFile(path, JSON.stringify({...json, services}));

    await update();

    deepStrictEqual(
      Object.keys(JSON.parse(await readFile(path, 'utf8')).services),
      ['backend1', 'alice', 'bob'],
      'The new compose file has all nodes',
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
