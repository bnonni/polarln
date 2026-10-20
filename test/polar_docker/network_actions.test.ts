import {deepStrictEqual} from 'node:assert/strict';
import {equal} from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFileSync} from 'node:fs';
import {mkdtemp} from 'node:fs/promises';
import {readFile} from 'node:fs/promises';
import {rm} from 'node:fs/promises';
import {writeFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import type {AddressInfo} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';

import dataFolder from '../../src/polar_docker/data_folder.js';
import type {DockerRunner} from '../../src/polar_docker/data_folder.js';
import executeTool from '../../src/polar_docker/execute_tool.js';
import makePolarDocker from '../../src/polar_docker/make_polar_docker.js';
import type {ActionSteps} from '../../src/polar_docker/network_actions.js';
import {startNetwork} from '../../src/polar_docker/network_actions.js';
import {stopNetwork} from '../../src/polar_docker/network_actions.js';
import {networkById} from '../../src/polar_docker/network_file.js';
import {saveNetwork} from '../../src/polar_docker/network_file.js';
import {startNode} from '../../src/polar_docker/node_actions.js';
import {stopNode} from '../../src/polar_docker/node_actions.js';
import setStatus from '../../src/polar_docker/set_status.js';
import {assertPolarLoadable} from '../fixtures/assert_polar_loadable.js';
import {fakeDockerRunner} from '../fixtures/fake_docker_runner.js';
import {rejection} from '../fixtures/rejection.js';

/** docker compose Command and the Statuses in the File at That Time */
type ComposeCall = {command: string; statuses: unknown[]};

type Setup = {
  /** Commands of the Fake docker Runner */
  calls: ComposeCall[];
  dataDir: string;
  /** Run the docker Program */
  docker: DockerRunner;
  /** docker compose Commands That Fail */
  fails: Set<string>;
  /** Networks File Path */
  file: string;
};

// Get the statuses of network 1 and its nodes in the networks file
const diskStatuses = (file: string): unknown[] => {
  const [network] = JSON.parse(readFileSync(file, 'utf8')).networks;
  const {bitcoin, lightning} = network.nodes;

  return [network.status, ...[...bitcoin, ...lightning].map(n => n.status)];
};

// Run a function with a temporary data folder and a fake docker runner. The
// runner records the statuses in the file at the time of each command. A
// command in a missing network directory fails as a real command does.
const withDataDir = async (use: (setup: Setup) => Promise<void>) => {
  const dataDir = await mkdtemp(join(tmpdir(), 'polarln-docker-'));
  const file = join(dataDir, 'networks', 'networks.json');

  const calls: ComposeCall[] = [];
  const fails = new Set<string>();

  const {docker} = fakeDockerRunner({
    respond: ({args, cwd}) => {
      const command = args[3];

      calls.push({command, statuses: diskStatuses(file)});

      if (!existsSync(cwd as string)) {
        throw {code: 'ENOENT', message: 'spawn docker ENOENT'};
      }

      if (fails.has(command)) {
        throw {code: 1, message: 'Command failed', stderr: `${command} failed`};
      }

      return '';
    },
  });

  try {
    await use({calls, dataDir, docker, fails, file});
  } finally {
    await rm(dataDir, {force: true, recursive: true});
  }
};

// Make a stopped network of backend1, alice, and bob. A port 0 never moves,
// so only a port that a test sets can move.
const makeNetwork = async (setup: Setup) => {
  const folder = dataFolder({
    dataDir: setup.dataDir,
    docker: setup.docker,
  });

  await executeTool({args: {name: 'n'}, folder, tool: 'create_network'});

  const network = await networkById({folder, id: 1});
  const {bitcoin, lightning} = network.nodes;

  [...bitcoin, ...lightning].forEach(node => {
    const ports = node.ports as {[port: string]: number};

    Object.keys(ports).forEach(port => (ports[port] = 0));
  });

  await saveNetwork({folder, network});

  return {folder, network};
};

// Get steps that save as polarDocker does, and record the statuses in the
// file after each write
const spySteps = (args: {file: string; monitor?: ActionSteps['monitor']}) => {
  const writes: unknown[][] = [];

  const steps: ActionSteps = {
    monitor:
      args.monitor ||
      (async () => {
        throw new Error('UnexpectedMonitorCall');
      }),
    save: async save => {
      await saveNetwork(save);

      await assertPolarLoadable(args.file);

      writes.push(diskStatuses(args.file));
    },
  };

  return {steps, writes};
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

test('A start saves the moved ports, then Started, then the results', () => {
  return withDataDir(async setup => {
    const {folder, network} = await makeNetwork(setup);
    const held = await holdPort();

    try {
      network.nodes.lightning[0].ports.rest = held.port;

      await saveNetwork({folder, network});

      const monitorSaw: unknown[][] = [];

      const {steps, writes} = spySteps({
        file: setup.file,
        monitor: async ({network}) => {
          monitorSaw.push(diskStatuses(setup.file));

          setStatus({
            error: new Error('e'),
            network,
            only: 'alice',
            status: 'Error',
          });
        },
      });

      await startNetwork({folder, network, steps});

      deepStrictEqual(
        writes,
        [
          [3, 3, 3, 3],
          [1, 1, 1, 1],
          [1, 1, 4, 1],
        ],
        'Got 3 writes with only final statuses',
      );

      deepStrictEqual(
        [setup.calls, monitorSaw],
        [[{command: 'up', statuses: [3, 3, 3, 3]}], [[1, 1, 1, 1]]],
        'The file has the moved ports before the containers start',
      );

      const saved = await networkById({folder, id: 1});
      const alice = saved.nodes.lightning[0];

      deepStrictEqual(
        [saved.status, alice.errorMsg, alice.ports.rest === held.port],
        ['Started', 'e', false],
        'The port moved, and the node has the result',
      );
    } finally {
      await held.close();
    }
  });
});

test('A failed start saves Error, and never Starting', () => {
  return withDataDir(async setup => {
    const {folder, network} = await makeNetwork(setup);
    const {steps, writes} = spySteps({file: setup.file});

    setup.fails.add('up');

    await rejection(startNetwork({folder, network, steps}));

    deepStrictEqual(
      [writes, setup.calls],
      [[[4, 4, 4, 4]], [{command: 'up', statuses: [3, 3, 3, 3]}]],
      'Got one write with the Error status',
    );
  });
});

test('A stop saves Stopped and no automatic mine after the stop', () => {
  return withDataDir(async setup => {
    const {folder, network} = await makeNetwork(setup);

    setStatus({network, status: 'Started'});

    network.autoMineMode = 30;

    await saveNetwork({folder, network});

    const {steps, writes} = spySteps({file: setup.file});

    await stopNetwork({folder, network, steps});

    deepStrictEqual(
      [writes, setup.calls],
      [[[3, 3, 3, 3]], [{command: 'down', statuses: [1, 1, 1, 1]}]],
      'Got one write with the Stopped status after the stop',
    );

    equal(
      (await networkById({folder, id: 1})).autoMineMode,
      0,
      'The automatic mine is off',
    );

    setStatus({network, status: 'Started'});

    await saveNetwork({folder, network});

    setup.fails.add('down');

    await rejection(stopNetwork({folder, network, steps}));

    deepStrictEqual(
      writes.slice(1),
      [[4, 4, 4, 4]],
      'A failed stop saves the Error status',
    );
  });
});

test('A node start and a node stop save only final statuses', () => {
  return withDataDir(async setup => {
    const {folder, network} = await makeNetwork(setup);
    const [alice] = network.nodes.lightning;
    const monitorSaw: unknown[][] = [];

    const {steps, writes} = spySteps({
      file: setup.file,
      monitor: async () => {
        monitorSaw.push(diskStatuses(setup.file));
      },
    });

    await startNode({folder, network, node: alice, steps});
    await stopNode({folder, network, node: alice, steps});

    setup.fails.add('up');

    await rejection(startNode({folder, network, node: alice, steps}));

    deepStrictEqual(
      writes,
      [
        [3, 3, 1, 3],
        [3, 3, 1, 3],
        [3, 3, 3, 3],
        [3, 3, 4, 3],
      ],
      'Got only final statuses',
    );

    deepStrictEqual(
      [setup.calls, monitorSaw],
      [
        [
          {command: 'stop', statuses: [3, 3, 3, 3]},
          {command: 'up', statuses: [3, 3, 3, 3]},
          {command: 'stop', statuses: [3, 3, 1, 3]},
          {command: 'stop', statuses: [3, 3, 3, 3]},
          {command: 'up', statuses: [3, 3, 3, 3]},
        ],
        [[3, 3, 1, 3]],
      ],
      'The file has no Starting or Stopping status at a docker command',
    );
  });
});

test('Failed tools leave Error, and never Starting or Stopping', () => {
  return withDataDir(async setup => {
    const {network} = await makeNetwork(setup);

    const {polar} = makePolarDocker({
      dataDir: setup.dataDir,
      docker: setup.docker,
      env: {},
      home: join(setup.dataDir, 'home'),
    });

    setup.fails.add('up');

    await rejection(polar.execute('start_network', {networkId: 1}));

    equal(existsSync(network.path), true, 'The network directory exists');

    // A network directory that is not there makes the docker command fail
    await rm(network.path, {force: true, recursive: true});

    const [, , details] = (await rejection(
      polar.execute('stop_network', {networkId: 1}),
    )) as [number, string, {err: string}];

    deepStrictEqual(
      [setup.calls, details.err],
      [
        [
          {command: 'up', statuses: [3, 3, 3, 3]},
          {command: 'down', statuses: [4, 4, 4, 4]},
        ],
        `Network directory ${network.path} does not exist`,
      ],
      'The file had only final statuses at each docker command',
    );

    deepStrictEqual(
      diskStatuses(setup.file),
      [4, 4, 4, 4],
      'The file has the Error status',
    );
  });
});

test('A start or a stop of a file that cannot be written runs no docker', () => {
  return withDataDir(async setup => {
    const {folder, network} = await makeNetwork(setup);

    // alice runs, so that the node stop tools get to the check
    setStatus({network, only: 'alice', status: 'Started'});

    await saveNetwork({folder, network});

    const {polar} = makePolarDocker({
      dataDir: setup.dataDir,
      docker: setup.docker,
      env: {},
      home: join(setup.dataDir, 'home'),
    });

    const json = JSON.parse(await readFile(setup.file, 'utf8'));

    await writeFile(
      setup.file,
      JSON.stringify({...json, version: '3.2.0'}, null, 2),
    );

    const before = await readFile(setup.file, 'utf8');

    const tools = [
      {args: {networkId: 1}, tool: 'start_network'},
      {args: {networkId: 1}, tool: 'stop_network'},
      {args: {networkId: 1, nodeName: 'bob'}, tool: 'start_node'},
      {args: {networkId: 1, nodeName: 'alice'}, tool: 'stop_node'},
      {args: {networkId: 1, nodeName: 'alice'}, tool: 'restart_node'},
    ];

    for (const {args, tool} of tools) {
      deepStrictEqual(
        await rejection(polar.execute(tool, args)),
        [
          501,
          'PolarToolNotSupported',
          {
            err: 'polarDocker does not support the networks file version "3.2.0" (only 4.0.0)',
            tool,
          },
        ],
        `${tool} gives the error`,
      );
    }

    deepStrictEqual(setup.calls, [], 'No docker command ran');

    equal(await readFile(setup.file, 'utf8'), before, 'The file is the same');
  });
});
