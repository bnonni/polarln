import {deepStrictEqual} from 'node:assert/strict';
import {rejects} from 'node:assert/strict';
import {strictEqual} from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {mkdtemp} from 'node:fs/promises';
import {rm} from 'node:fs/promises';
import {writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';

import dataFolder from '../../src/polar_docker/data_folder.js';
import type {DockerRunner} from '../../src/polar_docker/data_folder.js';
import runCompose from '../../src/polar_docker/run_compose.js';
import {composeError} from '../../src/polar_docker/run_compose.js';
import type {Network} from '../../src/typescript/index.js';
import {fakeDockerRunner} from '../fixtures/fake_docker_runner.js';

const path = '/data/networks/1';

const tests = [
  {
    description: 'A missing docker program means no Docker',
    err: {code: 'ENOENT', message: 'spawn docker ENOENT'},
    expected: 'Docker is not available: spawn docker ENOENT',
  },
  {
    description: 'A stopped Docker daemon means no Docker',
    err: {
      code: 1,
      message: 'Command failed',
      stderr:
        'Cannot connect to the Docker daemon at unix:///var/run/docker.sock.' +
        ' Is the docker daemon running?\n',
    },
    expected:
      'Docker is not available: Cannot connect to the Docker daemon at ' +
      'unix:///var/run/docker.sock. Is the docker daemon running?',
  },
  {
    description: 'A failed connection to the Docker API means no Docker',
    err: {
      code: 1,
      message: 'Command failed',
      stderr: 'failed to connect to the docker API at unix:///x.sock',
    },
    expected:
      'Docker is not available: failed to connect to the docker API at ' +
      'unix:///x.sock',
  },
  {
    description: 'No access to the Docker socket means no Docker',
    err: {
      code: 1,
      message: 'Command failed',
      stderr:
        'permission denied while trying to connect to the docker API at ' +
        'unix:///var/run/docker.sock',
    },
    expected:
      'Docker is not available: permission denied while trying to connect ' +
      'to the docker API at unix:///var/run/docker.sock',
  },
  {
    description: 'ENOENT without the network directory is a missing directory',
    err: {code: 'ENOENT', message: 'spawn docker ENOENT'},
    expected: `Network directory ${path} does not exist`,
    hasDir: false,
  },
  {
    description: 'Other failures keep the docker output without colors',
    err: {
      code: 1,
      message: 'Command failed',
      stderr: '\u001b[31mno such service: x\u001b[0m\n',
    },
    expected: 'no such service: x',
  },
];

tests.forEach(({description, err, expected, hasDir}) => {
  test(description, () => {
    const error = composeError({err, hasDir: hasDir ?? true, path});

    strictEqual(error.message, expected);
    strictEqual(error.cause, err);
  });
});

test('A missing network directory is not a Docker error', async () => {
  const path = await mkdtemp(join(tmpdir(), 'polarln-compose-'));

  await rm(path, {recursive: true});

  const folder = dataFolder({dataDir: '/data'});

  // The spawn fails before docker runs, so the test does not need Docker
  await rejects(
    runCompose({args: ['ps'], folder, network: {path} as Network}),
    {
      message: `Network directory ${path} does not exist`,
    },
  );
});

// Make a network directory with a compose file, and remove it after the use
const withNetworkDir = async (use: (path: string) => Promise<void>) => {
  const root = await mkdtemp(join(tmpdir(), 'polarln-compose-'));
  const path = join(root, 'networks', '1');

  try {
    await mkdir(path, {recursive: true});

    await writeFile(join(path, 'docker-compose.yml'), '{"services": {}}\n');

    await use(path);
  } finally {
    await rm(root, {force: true, recursive: true});
  }
};

test('docker compose runs with the docker runner of the data folder', () => {
  return withNetworkDir(async path => {
    const {calls, docker} = fakeDockerRunner({
      respond: () => '\u001b[32mout\u001b[0m',
    });

    const folder = dataFolder({dataDir: '/data', docker});

    const {out} = await runCompose({
      args: ['up', '-d'],
      folder,
      network: {id: 1, path} as Network,
    });

    strictEqual(out, 'out', 'Got the output without colors');

    // With no -f option, docker compose also reads an override file
    deepStrictEqual(
      calls,
      [{args: ['compose', '-p', 'polarln-network-1', 'up', '-d'], cwd: path}],
      'The runner gets the project name and the network directory',
    );
  });
});

test('The environment cannot change the compose project or file', () => {
  return withNetworkDir(async path => {
    const envs: NodeJS.ProcessEnv[] = [];

    const docker: DockerRunner = async (_args, options) => {
      envs.push(options.env || {});

      return {stderr: '', stdout: ''};
    };

    const values = {
      COMPOSE_FILE: join(tmpdir(), 'other.yml'),
      COMPOSE_PROJECT_NAME: 'other',
      POLARLN_TEST_VALUE: 'kept',
    };

    const before = Object.keys(values).map(key => [key, process.env[key]]);

    Object.assign(process.env, values);

    const folder = dataFolder({dataDir: '/data', docker});

    try {
      await runCompose({
        args: ['down'],
        folder,
        network: {id: 1, path} as Network,
      });
    } finally {
      before.forEach(([key, value]) => {
        if (value === undefined) {
          delete process.env[key as string];
        } else {
          process.env[key as string] = value;
        }
      });
    }

    deepStrictEqual(
      envs.map(env => [
        env.COMPOSE_FILE,
        env.COMPOSE_PROJECT_NAME,
        env.POLARLN_TEST_VALUE,
      ]),
      [[undefined, undefined, 'kept']],
      'docker compose gets the environment without the two variables',
    );
  });
});

test('A network directory with no compose file runs no docker compose', () => {
  return withNetworkDir(async path => {
    const {calls, docker} = fakeDockerRunner();

    const folder = dataFolder({dataDir: '/data', docker});

    // With no file, docker compose uses the file of a parent directory
    await writeFile(join(path, '..', 'docker-compose.yml'), '{}\n');
    await rm(join(path, 'docker-compose.yml'));

    await rejects(
      runCompose({args: ['down'], folder, network: {id: 1, path} as Network}),
      {message: `Network directory ${path} has no compose file`},
    );

    deepStrictEqual(calls, [], 'No docker command ran');

    // Docker compose also finds a compose.yaml file
    await writeFile(join(path, 'compose.yaml'), 'services: {}\n');

    await runCompose({
      args: ['down'],
      folder,
      network: {id: 1, path} as Network,
    });

    deepStrictEqual(
      calls,
      [{args: ['compose', '-p', 'polarln-network-1', 'down'], cwd: path}],
      'docker compose ran with the compose.yaml file',
    );
  });
});

test('A failed docker runner gives the compose error', () => {
  return withNetworkDir(async path => {
    const err = {
      code: 1,
      message: 'Command failed',
      stderr: 'no such service\n',
    };

    const {docker} = fakeDockerRunner({
      respond: () => {
        throw err;
      },
    });

    const folder = dataFolder({dataDir: '/data', docker});

    // The network directory exists, so the error is not a missing directory
    await rejects(
      runCompose({
        args: ['stop', 'x'],
        folder,
        network: {id: 1, path} as Network,
      }),
      {message: 'no such service'},
    );
  });
});
