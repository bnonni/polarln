import {deepStrictEqual} from 'node:assert/strict';
import {equal} from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {mkdtemp} from 'node:fs/promises';
import {readFile} from 'node:fs/promises';
import {rm} from 'node:fs/promises';
import {writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';

import {createNetwork} from '../../src/index.js';
import {deleteNetwork} from '../../src/index.js';
import type {Network} from '../../src/index.js';
import {listNetworks} from '../../src/index.js';
import {polarDocker} from '../../src/index.js';
import {renameNetwork} from '../../src/index.js';
import {startNetwork} from '../../src/index.js';
import {stopNetwork} from '../../src/index.js';
import type {CheckApp} from '../../src/polar_docker/data_folder.js';
import makePolarDocker from '../../src/polar_docker/make_polar_docker.js';
import {initChartFromNetwork} from '../../src/polar_docker/polar_chart.js';
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

test('A stopped network can be created, listed, renamed, and deleted', () => {
  return withDataDir(async dataDir => {
    // The delete looks for containers of the network, and there are none
    const {calls, docker} = fakeDockerRunner();

    const {polar} = makePolarDocker({
      dataDir,
      docker,
      env: {},
      home: join(dataDir, 'home'),
    });

    equal(polar.dataDir, dataDir, 'Got data directory');

    deepStrictEqual(await listNetworks({polar}), {networks: []}, 'No networks');

    const created = await createNetwork({description: 'd', name: 'one', polar});

    deepStrictEqual(
      [created.success, created.message, created.network.id],
      [true, 'Network "one" created successfully', 1],
      'Got created network',
    );

    const {path} = created.network;

    equal(
      existsSync(join(path, 'docker-compose.yml')),
      true,
      'Got compose file',
    );

    const networksFile = join(dataDir, 'networks', 'networks.json');
    const file = JSON.parse(await readFile(networksFile, 'utf8'));

    // The file has the Polar status numbers, and the results have the labels
    const stored = JSON.parse(
      JSON.stringify(created.network).replaceAll(
        '"status":"Stopped"',
        '"status":3',
      ),
    );

    deepStrictEqual(
      file,
      {
        charts: {1: initChartFromNetwork({network: created.network})},
        networks: [stored],
        version: '4.0.0',
      },
      'Got file with the Polar chart of the network',
    );

    await assertPolarLoadable(networksFile);

    const renamed = await renameNetwork({name: 'two', networkId: 1, polar});

    deepStrictEqual(
      [renamed.message, renamed.network.name, renamed.network.description],
      ['Network renamed to "two" successfully', 'two', 'd'],
      'Got renamed network',
    );

    const second = await createNetwork({name: 'three', polar});

    equal(second.network.id, 2, 'Got the next id');

    const deleted = await deleteNetwork({networkId: 1, polar});

    deepStrictEqual(
      [deleted.message, deleted.network.id],
      ['Network "two" deleted successfully', 1],
      'Got deleted network',
    );

    equal(existsSync(path), false, 'The network directory is removed');

    deepStrictEqual(
      (await listNetworks({polar})).networks.map(n => n.id),
      [2],
      'Got the other network',
    );

    deepStrictEqual(
      Object.keys(JSON.parse(await readFile(networksFile, 'utf8')).charts),
      ['2'],
      'The chart of the deleted network is gone',
    );

    await assertPolarLoadable(networksFile);

    deepStrictEqual(
      calls.map(({args}) => args.slice(0, 2)),
      [['ps', '-a']],
      'The delete looked for containers, and no compose command ran',
    );
  });
});

test('A new network does not use a directory that exists', () => {
  return withDataDir(async dataDir => {
    const {polar} = polarDocker({dataDir});

    await mkdir(join(dataDir, 'networks', '1'), {recursive: true});

    const {network} = await createNetwork({name: 'n', polar});

    equal(network.id, 2, 'Got the next free id');
  });
});

test('The data directory comes from the environment', () => {
  const {POLARLN_DATA_DIR} = process.env;

  process.env.POLARLN_DATA_DIR = '/tmp/polarln-env';

  equal(polarDocker().polar.dataDir, '/tmp/polarln-env', 'Got directory');

  process.env.POLARLN_DATA_DIR = POLARLN_DATA_DIR;

  if (POLARLN_DATA_DIR === undefined) {
    delete process.env.POLARLN_DATA_DIR;
  }
});

test('The internal maker gets the data directory from its arguments', () => {
  const home = join(tmpdir(), 'polarln-home');

  deepStrictEqual(
    [
      makePolarDocker({env: {}, home}).polar.dataDir,
      makePolarDocker({env: {POLARLN_DATA_DIR: '/tmp/e'}, home}).polar.dataDir,
      makePolarDocker({dataDir: 'x', env: {POLARLN_DATA_DIR: '/e'}, home}).polar
        .dataDir,
    ],
    [join(home, '.polar'), '/tmp/e', join(process.cwd(), 'x')],
    'The argument comes first, then the environment, then the Polar home',
  );
});

test('The default data directory is the data directory of the Polar app', () => {
  return withDataDir(async dir => {
    const home = join(dir, 'home');
    const xdg = join(home, '.local', 'share', 'polar');

    const dataDirOf = (env: {[name: string]: string}) =>
      makePolarDocker({env, home}).polar.dataDir;

    equal(dataDirOf({}), join(home, '.polar'), 'Got .polar with no folders');

    await mkdir(join(home, '.polar'), {recursive: true});

    equal(dataDirOf({}), join(home, '.polar'), 'Got .polar');

    await mkdir(xdg, {recursive: true});

    equal(dataDirOf({}), xdg, 'Got .local/share/polar if it exists');

    equal(
      dataDirOf({POLARLN_DATA_DIR: join(dir, 'env')}),
      join(dir, 'env'),
      'POLARLN_DATA_DIR comes before the Polar home',
    );
  });
});

test('With no data directory, list_networks reads the Polar networks', () => {
  return withPolarHome(async ({dataDir, home}) => {
    const {calls, docker} = fakeDockerRunner();
    const before = await snapshot(dataDir);
    const checks: string[] = [];

    const {polar} = makePolarDocker({
      checkApp: async () => {
        checks.push('check');

        return {runs: false};
      },
      docker,
      env: {},
      home,
    });

    equal(polar.dataDir, dataDir, 'Got the Polar home of the fixture');

    const {networks} = await listNetworks({polar});

    deepStrictEqual(
      networks.map(network => ({
        name: network.name,
        nodes: [
          ...network.nodes.bitcoin,
          ...network.nodes.lightning,
          ...network.nodes.tap,
        ].map(({name, status}) => [name, status]),
        status: network.status,
      })),
      [
        {
          name: 'tapd-net',
          nodes: [
            ['backend1', 'Stopped'],
            ['alice', 'Stopped'],
            ['alice-tap', 'Stopped'],
          ],
          status: 'Stopped',
        },
        {
          name: 'litd-net',
          nodes: [
            ['backend1', 'Stopped'],
            ['alice', 'Stopped'],
            ['bob', 'Stopped'],
          ],
          status: 'Stopped',
        },
        {
          name: 'electrs-net',
          nodes: [
            ['backend1', 'Stopped'],
            ['alice', 'Stopped'],
          ],
          status: 'Stopped',
        },
      ],
      'Got the networks of the fixture with the status labels',
    );

    deepStrictEqual(await snapshot(dataDir), before, 'The files stay');
    deepStrictEqual(calls, [], 'The list runs no docker command');
    deepStrictEqual(checks, [], 'A read does not check the Polar app');
  });
});

// The Polar app does not run, so the guard of the Polar home lets tools run
const appOff: CheckApp = async () => ({runs: false});

// Get the compose project name and the container names of a network
const composeNames = async (network: Network) => {
  const file = await readFile(join(network.path, 'docker-compose.yml'), 'utf8');

  const {name, services} = JSON.parse(file) as {
    name: string;
    services: {[service: string]: {container_name: string}};
  };

  return {
    containers: Object.values(services).map(n => n.container_name),
    project: name,
  };
};

test('The Polar home gets the container names of the Polar app', () => {
  return withPolarHome(async ({dataDir, file, home}) => {
    const {calls, docker} = fakeDockerRunner();

    const {polar} = makePolarDocker({
      checkApp: appOff,
      dataDir,
      docker,
      env: {},
      home,
    });

    const {network} = await createNetwork({name: 'n', polar});

    deepStrictEqual(
      await composeNames(network),
      {
        containers: ['polar-n4-backend1', 'polar-n4-alice', 'polar-n4-bob'],
        project: 'polar-network-4',
      },
      'Got the Polar names',
    );

    deepStrictEqual(calls, [], 'The create runs no docker command');

    await assertPolarLoadable(file);
  });
});

test('A different data folder gets the polarln container names', () => {
  return withDataDir(async dataDir => {
    const {docker} = fakeDockerRunner();

    const {polar} = makePolarDocker({
      dataDir,
      docker,
      env: {},
      home: join(dataDir, 'home'),
    });

    const {network} = await createNetwork({name: 'n', polar});

    deepStrictEqual(
      await composeNames(network),
      {
        containers: [
          'polarln-n1-backend1',
          'polarln-n1-alice',
          'polarln-n1-bob',
        ],
        project: 'polarln-network-1',
      },
      'Got the polarln names',
    );
  });
});

test('A network folder outside the data folder does not change', () => {
  return withPolarHome(async ({dataDir, file, home}) => {
    const {calls, docker} = fakeDockerRunner();

    // A copied home has the network folders of the original home
    const outside = join(home, 'original', 'networks', '3');
    const inside = join(dataDir, 'networks', '3');

    await mkdir(join(outside, 'volumes', 'lnd', 'alice'), {recursive: true});
    await writeFile(join(outside, 'docker-compose.yml'), 'original');
    await writeFile(join(outside, 'volumes', 'lnd', 'alice', 'tls.cert'), 'x');

    const json = JSON.parse(await readFile(file, 'utf8'));

    json.networks[2].path = outside;

    await writeFile(file, JSON.stringify(json, null, 2));

    const before = await readFile(file, 'utf8');

    const {polar} = makePolarDocker({
      checkApp: appOff,
      dataDir,
      docker,
      env: {},
      home,
    });

    const tools = [
      {args: {networkId: 3}, tool: 'start_network'},
      {args: {networkId: 3}, tool: 'stop_network'},
      {args: {networkId: 3}, tool: 'delete_network'},
      {args: {networkId: 3, nodeName: 'alice'}, tool: 'start_node'},
    ];

    for (const {args, tool} of tools) {
      deepStrictEqual(
        await rejection(polar.execute(tool, args)),
        [
          409,
          'NetworkPathOutsideDataFolder',
          {expected: inside, networkId: 3, path: outside},
        ],
        `${tool} gives the error`,
      );
    }

    deepStrictEqual(calls, [], 'No docker command ran');

    equal(await readFile(file, 'utf8'), before, 'The file is the same');

    deepStrictEqual(
      [
        await readFile(join(outside, 'docker-compose.yml'), 'utf8'),
        existsSync(join(outside, 'volumes', 'lnd', 'alice', 'tls.cert')),
        existsSync(join(inside, 'docker-compose.yml')),
        existsSync(join(inside, 'volumes', 'lnd', 'alice', 'tls.cert')),
      ],
      ['original', true, true, true],
      'The folders are the same',
    );
  });
});

test('A network stops with the docker runner of the data folder', () => {
  return withDataDir(async dataDir => {
    const {calls, docker} = fakeDockerRunner();

    const {polar} = makePolarDocker({
      dataDir,
      docker,
      env: {},
      home: join(dataDir, 'home'),
    });

    const {network} = await createNetwork({name: 'n', polar});

    const stopped = await stopNetwork({networkId: 1, polar});

    deepStrictEqual(
      [stopped.network.status, stopped.network.autoMineMode],
      ['Stopped', 0],
      'Got the stopped network',
    );

    deepStrictEqual(
      calls.map(({args, cwd}) => ({args: args.slice(0, 2), cwd})),
      [
        {args: ['ps', '-a'], cwd: undefined},
        {args: ['compose', '-p'], cwd: network.path},
      ],
      'The runner gets the container check, then the docker compose command',
    );

    deepStrictEqual(
      calls[1].args,
      ['compose', '-p', 'polarln-network-1', 'down'],
      'The stop runs docker compose down in the network folder, as Polar does',
    );
  });
});

test('Docker backend errors have the same shape as bridge errors', () => {
  return withDataDir(async dataDir => {
    const {polar} = polarDocker({dataDir});

    const tests = [
      {
        error: [
          404,
          'PolarNetworkNotFound',
          {
            err: "Network with the id '9' was not found.",
            tool: 'start_network',
          },
        ],
        run: () => startNetwork({networkId: 9, polar}),
      },
      {
        error: [
          400,
          'PolarRejectedArguments',
          {err: 'Network ID is required', tool: 'start_network'},
        ],
        run: () => startNetwork({networkId: 0, polar}),
      },
      {
        error: [
          400,
          'PolarRejectedArguments',
          {err: 'Network name is required', tool: 'create_network'},
        ],
        run: () => createNetwork({name: '', polar}),
      },
      {
        error: [
          400,
          'PolarRejectedArguments',
          {err: 'The nodes must be an array', tool: 'create_network'},
        ],
        run: () => createNetwork({name: 'n', nodes: {} as [], polar}),
      },
      {
        error: [
          501,
          'PolarToolNotSupported',
          {
            err: 'polarDocker does not support litd nodes yet',
            tool: 'create_network',
          },
        ],
        run: () => {
          const nodes = [{implementation: 'litd' as const}];

          return createNetwork({name: 'n', nodes, polar});
        },
      },
      {
        error: [
          501,
          'PolarToolNotSupported',
          {
            err: 'Unknown tool: mint_tap_asset (polarDocker does not support it yet)',
            tool: 'mint_tap_asset',
          },
        ],
        run: () => polar.execute('mint_tap_asset', {}),
      },
      {
        error: [
          501,
          'PolarToolNotSupported',
          {
            err: 'Unknown tool: toString (polarDocker does not support it yet)',
            tool: 'toString',
          },
        ],
        run: () => polar.execute('toString', {}),
      },
    ];

    for (const {error, run} of tests) {
      deepStrictEqual(await rejection(run()), error);
    }
  });
});

test('Changes in one process at the same time keep all networks', () => {
  return withDataDir(async dataDir => {
    const {polar} = polarDocker({dataDir});

    const names = ['a', 'b', 'c', 'd', 'e'];

    const created = await Promise.all(
      names.map(name => createNetwork({name, polar})),
    );

    // The checks before each change read the file, so the changes can run in
    // a different order than the calls
    deepStrictEqual(
      created.map(n => n.network.id).sort((a, b) => a - b),
      [1, 2, 3, 4, 5],
      'Got a different id for each network',
    );

    const byId = (networks: Network[]) =>
      networks
        .map(n => [n.id, n.name])
        .sort(([a], [b]) => Number(a) - Number(b));

    const {networks} = await listNetworks({polar});

    deepStrictEqual(
      [byId(networks), networks.map(n => n.name).sort()],
      [byId(created.map(n => n.network)), names],
      'Got all networks',
    );
  });
});
