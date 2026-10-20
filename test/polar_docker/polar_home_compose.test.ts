import {deepStrictEqual} from 'node:assert/strict';
import {equal} from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {writeFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import type {AddressInfo} from 'node:net';
import {join} from 'node:path';
import test from 'node:test';

import dataFolder from '../../src/polar_docker/data_folder.js';
import type {CheckApp} from '../../src/polar_docker/data_folder.js';
import makePolarDocker from '../../src/polar_docker/make_polar_docker.js';
import type {ActionSteps} from '../../src/polar_docker/network_actions.js';
import {startNetwork} from '../../src/polar_docker/network_actions.js';
import {networkById} from '../../src/polar_docker/network_file.js';
import {saveNetwork} from '../../src/polar_docker/network_file.js';
import {startNode} from '../../src/polar_docker/node_actions.js';
import type {PolarNode} from '../../src/typescript/index.js';
import {assertPolarLoadable} from '../fixtures/assert_polar_loadable.js';
import type {DockerCall} from '../fixtures/fake_docker_runner.js';
import {fakeDockerRunner} from '../fixtures/fake_docker_runner.js';
import {withPolarHome} from '../fixtures/polar_home.js';
import type {PolarHomeFixture} from '../fixtures/polar_home.js';
import {rejection} from '../fixtures/rejection.js';
import {snapshot} from '../fixtures/snapshot.js';

// These tests use the Polar home fixture. Its compose files have the Polar
// project names, and its ports are the Polar ports. Thus each test uses a
// fake docker runner and a start step that does not wait for the nodes.

type Container = {
  name: string;
  project: string;
  state: string;
  workingDir: string;
};

type Item = {[key: string]: any};

// The Polar app does not run, so the guard of the Polar home lets tools run
const appOff: CheckApp = async () => ({runs: false});

// A start step that must not run, so that no test waits for real nodes
const noMonitor: ActionSteps = {
  monitor: async () => {
    throw new Error('UnexpectedMonitorCall');
  },
  save: saveNetwork,
};

// A start step that does not wait for the nodes
const noWait: ActionSteps = {monitor: async () => {}, save: saveNetwork};

// Get the docker ps output of containers
const psOutput = (containers: Container[]) =>
  containers
    .map(c => JSON.stringify([c.name, c.state, c.project, c.workingDir]))
    .join('\n');

// Make a data folder of the fixture with a fake docker runner. The runner
// gives the containers to docker ps, the services to docker compose config,
// and no output to the other commands.
const setup = (
  fixture: PolarHomeFixture,
  args: {containers?: Container[]; services?: string[]} = {},
) => {
  const respond = ({args: dockerArgs}: DockerCall) => {
    if (dockerArgs[0] === 'ps') {
      return psOutput(args.containers || []);
    }

    if (dockerArgs[3] === 'config') {
      return (args.services || []).join('\n');
    }

    return '';
  };

  const {calls, docker} = fakeDockerRunner({respond});

  const folder = dataFolder({
    checkApp: appOff,
    dataDir: fixture.dataDir,
    docker,
    isPolarHome: true,
  });

  const {polar} = makePolarDocker({
    checkApp: appOff,
    dataDir: fixture.dataDir,
    docker,
    env: {},
    home: fixture.home,
  });

  // A short form of each command: 'ps', or the compose arguments
  const commands = () =>
    calls.map(({args}) => (args[0] === 'ps' ? 'ps' : args.slice(3).join(' ')));

  return {calls, commands, folder, polar};
};

const networkPath = (fixture: PolarHomeFixture, id: number) =>
  join(fixture.dataDir, 'networks', `${id}`);

const composePath = (fixture: PolarHomeFixture, id: number) =>
  join(networkPath(fixture, id), 'docker-compose.yml');

// Change the nodes of a fixture network in the networks file. The ports
// get 0 first: a port 0 never moves, so the tests do not depend on the
// ports that the machine uses.
const changeNodes = async (
  fixture: PolarHomeFixture,
  id: number,
  change: (node: Item) => void = () => {},
) => {
  const json = JSON.parse(await readFile(fixture.file, 'utf8'));
  const network = json.networks.find((n: Item) => n.id === id);
  const {bitcoin, lightning, tap} = network.nodes;

  [...bitcoin, ...lightning, ...tap].forEach((node: Item) => {
    Object.keys(node.ports).forEach(key => (node.ports[key] = 0));

    change(node);
  });

  await writeFile(fixture.file, JSON.stringify(json, null, 2));
};

// Get the statuses of a network, its nodes, and its chart nodes in the file
const fileStatuses = async (fixture: PolarHomeFixture, id: number) => {
  const json = JSON.parse(await readFile(fixture.file, 'utf8'));
  const network = json.networks.find((n: Item) => n.id === id);
  const {bitcoin, lightning, tap} = network.nodes;
  const chart = json.charts[id];

  return {
    chart: Object.values(chart.nodes as Item).map(n => n.properties.status),
    network: network.status,
    nodes: [...bitcoin, ...lightning, ...tap].map((n: Item) => n.status),
  };
};

// Hold a free port, so that a start must move it
const holdPort = async () => {
  const server = createServer();

  await new Promise<void>(resolve => server.listen(0, resolve));

  return {
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
    port: (server.address() as AddressInfo).port,
  };
};

test('A start uses the compose file of the network', () => {
  return withPolarHome(async fixture => {
    await changeNodes(fixture, 1);

    const before = await readFile(composePath(fixture, 1), 'utf8');
    const {commands, folder} = setup(fixture);
    const network = await networkById({folder, id: 1});

    await startNetwork({folder, network, steps: noWait});

    equal(
      await readFile(composePath(fixture, 1), 'utf8'),
      before,
      'The compose file with the tapd node is the same',
    );

    deepStrictEqual(commands(), ['ps', 'up -d'], 'Got the docker commands');

    deepStrictEqual(
      await fileStatuses(fixture, 1),
      {chart: [1, 1, 1], network: 1, nodes: [1, 1, 1]},
      'The network, the nodes, and the chart nodes have the Started status',
    );

    const volume = (...names: string[]) =>
      existsSync(join(networkPath(fixture, 1), 'volumes', ...names));

    deepStrictEqual(
      [volume('bitcoind', 'backend1'), volume('tapd', 'alice-tap')],
      [true, true],
      'The start made the volume folders',
    );

    await assertPolarLoadable(fixture.file);

    // A litd node gets the folders of its 3 daemons, as in Polar ensureDirs
    await changeNodes(fixture, 2);

    await startNetwork({
      folder,
      network: await networkById({folder, id: 2}),
      steps: noWait,
    });

    const litd = join(networkPath(fixture, 2), 'volumes', 'litd', 'bob');

    deepStrictEqual(
      ['lit', 'lnd', 'tapd'].map(name => existsSync(join(litd, name))),
      [true, true, true],
      'The start made the litd folders',
    );

    deepStrictEqual(
      commands(),
      ['ps', 'up -d', 'ps', 'up -d'],
      'The litd network started with its compose file',
    );
  });
});

test('A port in use that cannot move gives 409, and nothing changes', () => {
  return withPolarHome(async fixture => {
    const held = await holdPort();

    try {
      const holdRpc = (node: Item) => {
        if (node.name === 'backend1') {
          node.ports.rpc = held.port;
        }
      };

      await changeNodes(fixture, 1, holdRpc);
      await changeNodes(fixture, 3, holdRpc);

      const services = ['backend1', 'alice', 'electrs'];
      const {commands, folder} = setup(fixture, {services});

      const before = await snapshot(fixture.dataDir);

      deepStrictEqual(
        await rejection(
          startNetwork({
            folder,
            network: await networkById({folder, id: 1}),
            steps: noMonitor,
          }),
        ),
        [409, 'PolarPortInUse', {node: 'backend1', port: held.port}],
        'A tapd network cannot get a new compose file',
      );

      deepStrictEqual(
        await rejection(
          startNetwork({
            folder,
            network: await networkById({folder, id: 3}),
            steps: noMonitor,
          }),
        ),
        [
          409,
          'ComposeFileHasOtherServices',
          {networkId: 3, path: composePath(fixture, 3), services: ['electrs']},
        ],
        'A new compose file cannot delete the electrs service',
      );

      deepStrictEqual(
        commands(),
        ['ps', 'ps', 'config --services'],
        'No container changed',
      );

      deepStrictEqual(
        await snapshot(fixture.dataDir),
        before,
        'The files are the same',
      );
    } finally {
      await held.close();
    }
  });
});

test('The port error gives the port that is in use', () => {
  return withPolarHome(async fixture => {
    const held = await holdPort();

    try {
      await changeNodes(fixture, 1);

      // backend2 has a port in use, and backend1 has a port that is free
      const json = JSON.parse(await readFile(fixture.file, 'utf8'));
      const {bitcoin} = json.networks[0].nodes;
      const [backend1] = bitcoin;

      bitcoin.push({
        ...backend1,
        id: 1,
        name: 'backend2',
        ports: {...backend1.ports, rpc: held.port},
      });

      await writeFile(fixture.file, JSON.stringify(json, null, 2));

      const {folder} = setup(fixture);

      deepStrictEqual(
        await rejection(
          startNetwork({
            folder,
            network: await networkById({folder, id: 1}),
            steps: noMonitor,
          }),
        ),
        [409, 'PolarPortInUse', {node: 'backend2', port: held.port}],
        'The error gives the node and the port that is in use',
      );
    } finally {
      await held.close();
    }
  });
});

test('A port that a container of the network holds does not move', () => {
  return withPolarHome(async fixture => {
    const held = await holdPort();

    try {
      await changeNodes(fixture, 1, node => {
        if (node.name === 'backend1') {
          node.ports.rpc = held.port;
        }
      });

      const before = await readFile(composePath(fixture, 1), 'utf8');

      const {commands, folder} = setup(fixture, {
        containers: [
          {
            name: 'polar-n1-backend1',
            project: 'polar-network-1',
            state: 'running',
            workingDir: networkPath(fixture, 1),
          },
        ],
      });

      await startNetwork({
        folder,
        network: await networkById({folder, id: 1}),
        steps: noWait,
      });

      const saved = await networkById({folder, id: 1});

      deepStrictEqual(
        [
          commands(),
          saved.nodes.bitcoin[0].ports.rpc,
          await readFile(composePath(fixture, 1), 'utf8'),
        ],
        [['ps', 'up -d'], held.port, before],
        'The port and the compose file stay',
      );
    } finally {
      await held.close();
    }
  });
});

test('A node start checks only the ports of the nodes that start', () => {
  return withPolarHome(async fixture => {
    const held = await holdPort();

    try {
      // A node that does not start has a port in use
      await changeNodes(fixture, 1, node => {
        if (node.name === 'alice') {
          node.ports.grpc = held.port;
        }
      });

      await changeNodes(fixture, 3, node => {
        if (node.name === 'backend1') {
          node.ports.rpc = held.port;
        }
      });

      const services = ['backend1', 'alice', 'electrs'];
      const {commands, folder} = setup(fixture, {services});

      const composeFiles = () =>
        Promise.all(
          [1, 3].map(id => readFile(composePath(fixture, id), 'utf8')),
        );

      const before = await composeFiles();

      const start = async (id: number, name: string, steps: ActionSteps) => {
        const network = await networkById({folder, id});
        const {bitcoin, lightning, tap} = network.nodes;
        const nodes: PolarNode[] = [...bitcoin, ...lightning, ...tap];
        const node = nodes.find(n => n.name === name) as PolarNode;

        return startNode({folder, network, node, steps});
      };

      // No port of the tapd network can move, and backend1 needs no move
      await start(1, 'backend1', noWait);

      // A new compose file cannot delete electrs, and alice needs no move
      await start(3, 'alice', noWait);

      deepStrictEqual(
        commands(),
        [
          'ps',
          'stop backend1',
          'up -d backend1',
          'ps',
          'config --services',
          'stop alice',
          'up -d alice',
        ],
        'The nodes started with their compose files',
      );

      const saved = await Promise.all(
        [1, 3].map(id => networkById({folder, id})),
      );

      deepStrictEqual(
        [
          (saved[0].nodes.lightning[0].ports as Item).grpc,
          saved[1].nodes.bitcoin[0].ports.rpc,
          await composeFiles(),
        ],
        [held.port, held.port, before],
        'The ports and the compose files stay',
      );

      // A port in use of a node that starts still gives the error
      deepStrictEqual(
        await rejection(start(1, 'alice', noMonitor)),
        [409, 'PolarPortInUse', {node: 'alice', port: held.port}],
        'The start of alice on the tapd network gives the error',
      );

      deepStrictEqual(
        await rejection(start(3, 'backend1', noMonitor)),
        [
          409,
          'ComposeFileHasOtherServices',
          {networkId: 3, path: composePath(fixture, 3), services: ['electrs']},
        ],
        'The start of backend1 on the electrs network gives the error',
      );
    } finally {
      await held.close();
    }
  });
});

test('A restart checks only the ports of the node that restarts', () => {
  return withPolarHome(async fixture => {
    const held = await holdPort();

    try {
      // alice-tap runs, and alice has a port in use
      await changeNodes(fixture, 1, node => {
        if (node.name === 'alice') {
          node.ports.grpc = held.port;
        }

        if (node.name === 'alice-tap') {
          node.status = 1;
        }
      });

      const {commands, polar} = setup(fixture, {
        containers: [
          {
            name: 'polar-n1-alice-tap',
            project: 'polar-network-1',
            state: 'running',
            workingDir: networkPath(fixture, 1),
          },
        ],
      });

      await polar.execute('restart_node', {
        networkId: 1,
        nodeName: 'alice-tap',
      });

      deepStrictEqual(
        commands(),
        [
          'ps',
          'ps',
          'stop alice-tap',
          'ps',
          'stop alice-tap',
          'up -d alice-tap',
          'ps',
        ],
        'The node stopped and started again',
      );

      deepStrictEqual(
        (await fileStatuses(fixture, 1)).nodes,
        [3, 3, 1],
        'Only alice-tap has the Started status',
      );
    } finally {
      await held.close();
    }
  });
});

test('A restart that the start checks refuse does not stop the node', () => {
  return withPolarHome(async fixture => {
    const held = await holdPort();

    try {
      // alice-tap has the Started status, but its container does not run
      await changeNodes(fixture, 1, node => {
        if (node.name === 'alice-tap') {
          node.ports.grpc = held.port;
          node.status = 1;
        }
      });

      const {commands, polar} = setup(fixture, {
        containers: [
          {
            name: 'polar-n1-alice-tap',
            project: 'polar-network-1',
            state: 'exited',
            workingDir: networkPath(fixture, 1),
          },
        ],
      });

      const before = await snapshot(fixture.dataDir);

      deepStrictEqual(
        await rejection(
          polar.execute('restart_node', {networkId: 1, nodeName: 'alice-tap'}),
        ),
        [409, 'PolarPortInUse', {node: 'alice-tap', port: held.port}],
        'The start of alice-tap gives the error',
      );

      deepStrictEqual(commands(), ['ps'], 'Only the container check ran');

      deepStrictEqual(
        await snapshot(fixture.dataDir),
        before,
        'The node keeps its status, and the files are the same',
      );
    } finally {
      await held.close();
    }
  });
});

test('A container of a different folder gives 409, and nothing changes', () => {
  return withPolarHome(async fixture => {
    await changeNodes(fixture, 1, node => (node.status = 1));

    const other = join(fixture.home, 'copy', 'networks', '1');

    const conflicts: Container[] = [
      // A copy of the home started network 1
      {
        name: 'polar-n1-alice',
        project: 'polar-network-1',
        state: 'running',
        workingDir: other,
      },
      // A different project has the name of a node container
      {
        name: 'polar-n1-backend1',
        project: 'other',
        state: 'exited',
        workingDir: networkPath(fixture, 1),
      },
      // A container with no compose labels has the name of a node container
      {
        name: 'polar-n1-alice-tap',
        project: '',
        state: 'created',
        workingDir: '',
      },
      // A copy of the home has a different container in the project
      {
        name: 'electrs',
        project: 'polar-network-1',
        state: 'running',
        workingDir: other,
      },
    ];

    const before = await snapshot(fixture.dataDir);

    for (const conflict of conflicts) {
      const {commands, folder, polar} = setup(fixture, {
        containers: [conflict],
      });

      const inUse = [
        409,
        'ContainerNameInUse',
        {
          container: conflict.name,
          project: conflict.project,
          workingDir: conflict.workingDir,
        },
      ];

      deepStrictEqual(
        await rejection(
          startNetwork({
            folder,
            network: await networkById({folder, id: 1}),
            steps: noMonitor,
          }),
        ),
        inUse,
        `The start of ${conflict.name} gives the error`,
      );

      for (const tool of ['stop_network', 'delete_network']) {
        deepStrictEqual(
          await rejection(polar.execute(tool, {networkId: 1})),
          inUse,
          `${tool} with ${conflict.name} gives the error`,
        );
      }

      deepStrictEqual(
        await rejection(
          polar.execute('stop_node', {networkId: 1, nodeName: 'alice'}),
        ),
        inUse,
        `stop_node with ${conflict.name} gives the error`,
      );

      deepStrictEqual(
        commands(),
        ['ps', 'ps', 'ps', 'ps'],
        'Only the container checks ran',
      );
    }

    deepStrictEqual(
      await snapshot(fixture.dataDir),
      before,
      'The files are the same',
    );
  });
});

test('A stop runs docker compose down and saves Stopped', () => {
  return withPolarHome(async fixture => {
    await changeNodes(fixture, 1, node => (node.status = 1));

    const json = JSON.parse(await readFile(fixture.file, 'utf8'));

    json.networks[0].status = 1;

    await writeFile(fixture.file, JSON.stringify(json, null, 2));

    const {calls, polar} = setup(fixture);

    await polar.execute('stop_network', {networkId: 1});

    deepStrictEqual(
      calls.map(({args}) => (args[0] === 'ps' ? 'ps' : args)),
      ['ps', ['compose', '-p', 'polar-network-1', 'down']],
      'The stop runs down with no --remove-orphans, as Polar does',
    );

    deepStrictEqual(
      await fileStatuses(fixture, 1),
      {chart: [3, 3, 3], network: 3, nodes: [3, 3, 3]},
      'The network, the nodes, and the chart nodes have the Stopped status',
    );

    await assertPolarLoadable(fixture.file);
  });
});

test('A delete stops a network with a tapd node or a container that runs', () => {
  return withPolarHome(async fixture => {
    // Only the tapd node of network 1 has the Started status
    await changeNodes(fixture, 1, node => {
      if (node.type === 'tap') {
        node.status = 1;
      }
    });

    // All statuses of network 3 are Stopped, but the electrs container runs
    const electrs: Container = {
      name: 'esplora-electrs',
      project: 'polar-network-3',
      state: 'running',
      workingDir: networkPath(fixture, 3),
    };

    const {commands, polar} = setup(fixture, {containers: [electrs]});

    await polar.execute('delete_network', {networkId: 1});
    await polar.execute('delete_network', {networkId: 3});

    deepStrictEqual(
      commands(),
      ['ps', 'ps', 'down', 'ps', 'ps', 'down'],
      'Each delete stopped the network',
    );

    deepStrictEqual(
      [
        existsSync(networkPath(fixture, 1)),
        existsSync(networkPath(fixture, 3)),
      ],
      [false, false],
      'The network folders are gone',
    );

    const json = JSON.parse(await readFile(fixture.file, 'utf8'));

    deepStrictEqual(
      [json.networks.map((n: Item) => n.id), Object.keys(json.charts)],
      [[2], ['2']],
      'Only network 2 stays',
    );
  });
});
