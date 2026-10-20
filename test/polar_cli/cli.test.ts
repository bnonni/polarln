import {execFile} from 'node:child_process';
import {deepStrictEqual} from 'node:assert/strict';
import {strictEqual} from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

import packageJson from '../../package.json' with {type: 'json'};
import findPolarProcess from '../../src/polar_app/find_polar_process.js';
import type {Network} from '../../src/index.js';
import {withPolarHome} from '../fixtures/polar_home.js';
import {snapshot} from '../fixtures/snapshot.js';

const entry = fileURLToPath(new URL('../../src/cli.ts', import.meta.url));

// The spawned CLI scans the processes. A Polar process gives 409, not docker.
const polarProcess = await findPolarProcess();

// Get the environment of a child, with no polarln and Polar variables
const childEnv = (env: {[name: string]: string}) => {
  const {
    POLAR_MCP_PORT: _port,
    POLARLN_BACKEND: _backend,
    POLARLN_DATA_DIR: _dataDir,
    ...rest
  } = process.env;

  return {...rest, ...env};
};

// Get a port with no listener: listen on a free port, then close it. Node
// fetch blocks low ports such as port 1, so the port must be high.
const closedPort = async () => {
  const server = createServer();

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));

  const address = server.address();

  await new Promise(resolve => server.close(resolve));

  if (!address || typeof address === 'string') {
    throw new Error('ExpectedPortOfServer');
  }

  return address.port;
};

test('The entry file shows the package version', async () => {
  const {stdout} = await promisify(execFile)(process.execPath, [
    entry,
    '--version',
  ]);

  strictEqual(stdout, `${packageJson.version}\n`);
});

test('The entry file exits after a docker command', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'polarln-cli-'));

  try {
    const {stdout} = await promisify(execFile)(
      process.execPath,
      [entry, 'list-networks'],
      {
        env: childEnv({
          HOME: dataDir,
          POLARLN_BACKEND: 'docker',
          POLARLN_DATA_DIR: dataDir,
        }),
        timeout: 10_000,
      },
    );

    strictEqual(stdout, '{\n  "networks": []\n}\n');
  } finally {
    await rm(dataDir, {force: true, recursive: true});
  }
});

test(
  'The entry file with no flags lists the networks of the Polar home',
  {skip: polarProcess.result === 'found' ? 'A Polar process runs' : false},
  () => {
    return withPolarHome(async ({dataDir, home}) => {
      const before = await snapshot(dataDir);

      const {stderr, stdout} = await promisify(execFile)(
        process.execPath,
        [entry, 'list-networks'],
        {
          env: childEnv({
            HOME: home,
            POLAR_MCP_PORT: `${await closedPort()}`,
          }),
          timeout: 10_000,
        },
      );

      strictEqual(stderr, '');

      const {networks} = JSON.parse(stdout) as {networks: Network[]};

      deepStrictEqual(
        networks.map(({name, nodes, status}) => ({
          name,
          status,
          statuses: [...nodes.bitcoin, ...nodes.lightning, ...nodes.tap].map(
            node => node.status,
          ),
        })),
        [
          {
            name: 'tapd-net',
            status: 'Stopped',
            statuses: ['Stopped', 'Stopped', 'Stopped'],
          },
          {
            name: 'litd-net',
            status: 'Stopped',
            statuses: ['Stopped', 'Stopped', 'Stopped'],
          },
          {
            name: 'electrs-net',
            status: 'Stopped',
            statuses: ['Stopped', 'Stopped'],
          },
        ],
        'Got the fixture networks with the status labels',
      );

      deepStrictEqual(await snapshot(dataDir), before, 'The files stay');
    });
  },
);
