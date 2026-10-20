import {deepStrictEqual} from 'node:assert/strict';
import {equal} from 'node:assert/strict';
import {ok} from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {mkdtemp} from 'node:fs/promises';
import {readlink} from 'node:fs/promises';
import {rm} from 'node:fs/promises';
import {symlink} from 'node:fs/promises';
import {writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';

import findPolarProcess from '../../src/polar_app/find_polar_process.js';
import type {PolarProcessScan} from '../../src/polar_app/find_polar_process.js';

type FakeProc = {
  /** Name of Each Process (undefined: the process has no comm file) */
  comms: {[pid: number]: string | undefined};
  /** Target of the /proc/self/ns/pid Link (null: no link) */
  pidNamespace?: string | null;
  /** Lines of /proc/self/status */
  status?: string;
};

// The first PID namespace of Linux, and a PID namespace of a container
const hostPidNamespace = 'pid:[4026531836]';
const otherPidNamespace = 'pid:[4026533324]';

const hostStatus = 'Name:\tbun\nPid:\t99\nNSpid:\t99\nVmRSS:\t1 kB\n';

// Run a function with a fake proc folder in the temporary folder
const withProc = async (
  fake: FakeProc,
  use: (root: string) => Promise<void>,
) => {
  const root = await mkdtemp(join(tmpdir(), 'polarln-proc-'));

  try {
    await mkdir(join(root, 'self', 'ns'), {recursive: true});
    await writeFile(join(root, 'self', 'status'), fake.status ?? hostStatus);

    // The kernel shows the PID namespace as the target of a link
    if (fake.pidNamespace !== null) {
      const target = fake.pidNamespace ?? hostPidNamespace;

      await symlink(target, join(root, 'self', 'ns', 'pid'));
    }

    // The proc folder also has folders that are not process ids
    await mkdir(join(root, 'sys'));

    for (const [pid, comm] of Object.entries(fake.comms)) {
      await mkdir(join(root, pid));

      if (comm !== undefined) {
        await writeFile(join(root, pid, 'comm'), `${comm}\n`);
      }
    }

    await use(root);
  } finally {
    await rm(root, {force: true, recursive: true});
  }
};

const scanLinux = (procRoot: string, pid = 99) =>
  findPolarProcess({pid, platform: 'linux', procRoot});

const messageOf = (scan: PolarProcessScan) =>
  scan.result === 'unknown' ? (scan.err as Error).message : undefined;

test('The scan finds only a process with the name polar', () => {
  const comms = {10: 'polarln', 11: 'node', 12: 'bun', 13: 'polar', 14: 'sh'};

  return withProc({comms}, async procRoot => {
    deepStrictEqual(
      await scanLinux(procRoot),
      {pid: 13, result: 'found'},
      'Got the polar process',
    );
  });
});

test('The scan finds no process if no process has the name polar', () => {
  const comms = {10: 'polarln', 11: 'node', 12: 'bun', 13: 'Polar'};

  return withProc({comms}, async procRoot => {
    deepStrictEqual(
      await scanLinux(procRoot),
      {result: 'none'},
      'Got no process',
    );
  });
});

test('The scan skips the own process', () => {
  return withProc({comms: {13: 'polar'}}, async procRoot => {
    deepStrictEqual(
      await scanLinux(procRoot, 13),
      {result: 'none'},
      'Got no process',
    );
  });
});

test('The scan skips a process that ends during the scan', () => {
  return withProc({comms: {12: undefined, 13: 'polar'}}, async procRoot => {
    deepStrictEqual(
      await scanLinux(procRoot),
      {pid: 13, result: 'found'},
      'Got the polar process after the process with no name',
    );
  });
});

test('A PID namespace gives an unknown result', async () => {
  const message = 'A PID namespace hides the processes of the host';

  // A container mounts its own proc folder, so NSpid has 1 value
  for (const comms of [{13: 'polar'}, {13: 'sh'}]) {
    await withProc({comms, pidNamespace: otherPidNamespace}, async procRoot => {
      const scan = await scanLinux(procRoot);

      deepStrictEqual(
        [scan.result, messageOf(scan)],
        ['unknown', message],
        'Got unknown',
      );
    });
  }
});

test('A proc folder with no PID namespace link gives an unknown result', () => {
  return withProc({comms: {13: 'polar'}, pidNamespace: null}, async root => {
    equal((await scanLinux(root)).result, 'unknown', 'Got unknown');
  });
});

test('An NSpid line with 2 values gives an unknown result', () => {
  const status = 'Name:\tbun\nNSpid:\t5123\t1\n';

  return withProc({comms: {13: 'polar'}, status}, async procRoot => {
    const scan = await scanLinux(procRoot);

    deepStrictEqual(
      [scan.result, messageOf(scan)],
      ['unknown', 'The NSpid line shows a PID namespace'],
      'Got unknown',
    );
  });
});

test('A process status with no NSpid line gives an unknown result', () => {
  const status = 'Name:\tbun\nPid:\t99\n';

  return withProc({comms: {13: 'polar'}, status}, async procRoot => {
    const scan = await scanLinux(procRoot);

    deepStrictEqual(
      [scan.result, messageOf(scan)],
      ['unknown', 'The process status has no NSpid line'],
      'Got unknown',
    );
  });
});

test('A proc folder that is not there gives an unknown result', async () => {
  const scan = await scanLinux(join(tmpdir(), 'polarln-no-proc', 'proc'));

  equal(scan.result, 'unknown', 'Got unknown');
});

test('An unknown platform gives an unknown result', async () => {
  const scan = await findPolarProcess({platform: 'win32'});

  deepStrictEqual(
    [scan.result, messageOf(scan)],
    ['unknown', 'polarln cannot scan the processes on win32'],
    'Got unknown',
  );
});

test('On macOS, the scan finds the Polar program in the ps output', async () => {
  const output = [
    '    1 /sbin/launchd',
    '  200 /Applications/Polar.app/Contents/MacOS/Polar',
    '  201 /Applications/Polar.app/Contents/Frameworks/Polar Helper (Renderer).app/Contents/MacOS/Polar Helper (Renderer)',
    '  202 /usr/local/bin/polarln',
    '',
  ].join('\n');

  const scan = (pid: number) =>
    findPolarProcess({pid, platform: 'darwin', ps: async () => output});

  const failed = await findPolarProcess({
    platform: 'darwin',
    ps: async () => {
      throw new Error('spawn ps ENOENT');
    },
  });

  deepStrictEqual(
    [await scan(99), await scan(200), failed.result],
    [{pid: 200, result: 'found'}, {result: 'none'}, 'unknown'],
    'Got the Polar program, then no program for the own pid, then unknown',
  );
});

test(
  'The scan reads the real proc folder',
  {skip: process.platform !== 'linux'},
  async () => {
    const scan = await findPolarProcess();

    const namespace = await readlink('/proc/self/ns/pid').catch(() => '');

    if (namespace !== hostPidNamespace) {
      equal(scan.result, 'unknown', 'Got unknown in a PID namespace');

      return;
    }

    ok(['found', 'none'].includes(scan.result), 'Got a clear result');
  },
);
