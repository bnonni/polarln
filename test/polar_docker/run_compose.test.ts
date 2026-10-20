import {deepStrictEqual} from 'node:assert/strict';
import {rejects} from 'node:assert/strict';
import {strictEqual} from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';

import dataFolder from '../../src/polar_docker/data_folder.js';
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

test('docker compose runs with the docker runner of the data folder', async () => {
  const {calls, docker} = fakeDockerRunner({
    respond: () => '\u001b[32mout\u001b[0m',
  });

  const folder = dataFolder({dataDir: '/data', docker});

  const {out} = await runCompose({
    args: ['up', '-d'],
    folder,
    network: {path} as Network,
  });

  strictEqual(out, 'out', 'Got the output without colors');

  deepStrictEqual(
    calls,
    [
      {
        args: ['compose', '-f', join(path, 'docker-compose.yml'), 'up', '-d'],
        cwd: path,
      },
    ],
    'The runner gets the compose file and the network directory',
  );
});

test('A failed docker runner gives the compose error', async () => {
  const err = {code: 1, message: 'Command failed', stderr: 'no such service\n'};

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
      network: {path: tmpdir()} as Network,
    }),
    {message: 'no such service'},
  );
});
