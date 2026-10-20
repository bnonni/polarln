import {deepStrictEqual} from 'node:assert/strict';
import {equal} from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {mkdtemp} from 'node:fs/promises';
import {readFile} from 'node:fs/promises';
import {rm} from 'node:fs/promises';
import {utimes} from 'node:fs/promises';
import {writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

import dataFolder from '../../src/polar_docker/data_folder.js';
import lockNetworksFile from '../../src/polar_docker/lock_networks_file.js';
import {changeNetworks} from '../../src/polar_docker/network_file.js';
import {delay} from '../../src/polar_docker/wait_for.js';
import {withPolarHome} from '../fixtures/polar_home.js';
import {rejection} from '../fixtures/rejection.js';

const run = promisify(execFile);

const child = fileURLToPath(
  new URL('../fixtures/change_networks_child.ts', import.meta.url),
);

const lockPath = (dataDir: string) =>
  join(dataDir, 'networks', 'networks.json.lock');

const withDataDir = async (use: (dataDir: string) => Promise<void>) => {
  const dataDir = await mkdtemp(join(tmpdir(), 'polarln-docker-'));

  try {
    await use(dataDir);
  } finally {
    await rm(dataDir, {force: true, recursive: true});
  }
};

test('A second lock waits and gets the lock after the first one ends', () => {
  return withDataDir(async dataDir => {
    const events: string[] = [];

    let release = () => {};
    let started = () => {};

    const held = new Promise<void>(resolve => (release = resolve));
    const firstStarted = new Promise<void>(resolve => (started = resolve));

    const first = lockNetworksFile({
      dataDir,
      use: async () => {
        started();

        await held;

        events.push('first');
      },
    });

    await firstStarted;

    const second = lockNetworksFile({
      dataDir,
      use: async () => {
        events.push('second');

        return 'second result';
      },
    });

    await delay(100);

    deepStrictEqual(events, [], 'The second lock waits');

    release();

    await first;

    equal(await second, 'second result', 'Got the result of the function');

    deepStrictEqual(events, ['first', 'second'], 'The functions ran in order');
  });
});

test('A held lock gives 409 after the timeout', () => {
  return withDataDir(async dataDir => {
    await mkdir(lockPath(dataDir), {recursive: true});

    const start = Date.now();
    let ran = false;

    deepStrictEqual(
      await rejection(
        lockNetworksFile({
          dataDir,
          timeout: 100,
          use: async () => {
            ran = true;
          },
        }),
      ),
      [409, 'NetworksFileBusy', {dataDir}],
      'Got the busy error',
    );

    equal(Date.now() - start >= 50, true, 'The lock waited');
    equal(ran, false, 'The function did not run');
    equal(existsSync(lockPath(dataDir)), true, 'The held lock stays');
  });
});

test('A lock folder with an old time is replaced', () => {
  return withDataDir(async dataDir => {
    await mkdir(lockPath(dataDir), {recursive: true});

    // A process that stopped 60 s ago left its lock
    const old = Date.now() / 1000 - 60;

    await utimes(lockPath(dataDir), old, old);

    equal(
      await lockNetworksFile({dataDir, timeout: 100, use: async () => 'ran'}),
      'ran',
      'Got the lock',
    );

    equal(existsSync(lockPath(dataDir)), false, 'The lock is removed');
  });
});

test('The lock folder does not stay after a change', () => {
  return withDataDir(async dataDir => {
    const folder = dataFolder({dataDir});

    await changeNetworks({change: () => {}, folder});

    equal(existsSync(lockPath(dataDir)), false, 'No lock after a change');

    await rejection(
      changeNetworks({
        change: () => {
          throw new Error('ChangeFailed');
        },
        folder,
      }),
    );

    equal(existsSync(lockPath(dataDir)), false, 'No lock after a failure');

    await writeFile(join(dataDir, 'networks', 'networks.json'), '{');

    await rejection(changeNetworks({change: () => {}, folder}));

    equal(existsSync(lockPath(dataDir)), false, 'No lock after a bad file');
  });
});

test('Changes from 2 processes to 2 networks keep both changes', () => {
  return withPolarHome(async ({dataDir}) => {
    const changes = 30;

    // The 2 processes start their changes at the same time
    const startAt = `${Date.now() + 500}`;

    const change = (id: number) =>
      run(process.execPath, [child, dataDir, `${id}`, `${changes}`, startAt]);

    await Promise.all([change(1), change(2)]);

    const file = JSON.parse(
      await readFile(join(dataDir, 'networks', 'networks.json'), 'utf8'),
    );

    deepStrictEqual(
      file.networks.map((n: {count?: number}) => n.count),
      [changes, changes, undefined],
      'Got all changes of the 2 processes',
    );

    equal(existsSync(lockPath(dataDir)), false, 'No lock stays');
  });
});
