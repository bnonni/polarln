import {deepStrictEqual} from 'node:assert/strict';
import {equal} from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {mkdtemp} from 'node:fs/promises';
import {readFile} from 'node:fs/promises';
import {readdir} from 'node:fs/promises';
import {rm} from 'node:fs/promises';
import {writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';

import writeFileAtomic from '../../src/polar_docker/write_file_atomic.js';
import {rejection} from '../fixtures/rejection.js';
import {spyOnSync} from '../fixtures/sync_spy.js';

// Run a test in a new temporary folder, and remove the folder after it
const withFolder = async (use: (dir: string) => Promise<void>) => {
  const dir = await mkdtemp(join(tmpdir(), 'polarln-write-'));

  try {
    await use(dir);
  } finally {
    await rm(dir, {force: true, recursive: true});
  }
};

const tempFiles = (dir: string) =>
  readdirSync(dir).filter(n => n.endsWith('.tmp'));

test('The new text goes to the disk before the rename', () => {
  return withFolder(async dir => {
    const path = join(dir, 'networks.json');

    await writeFile(path, 'old');

    // At each sync, get the text of the file and the temporary files
    const syncs: [string, number][] = [];

    const restore = await spyOnSync(() => {
      syncs.push([readFileSync(path, 'utf8'), tempFiles(dir).length]);
    });

    try {
      await writeFileAtomic({path, text: 'new'});
    } finally {
      restore();
    }

    deepStrictEqual(
      syncs,
      [
        ['old', 1],
        ['new', 0],
      ],
      'The temporary file syncs before the rename, and the folder after it',
    );

    equal(await readFile(path, 'utf8'), 'new', 'The file has the new text');
  });
});

test('A new file gets the text', () => {
  return withFolder(async dir => {
    const path = join(dir, 'docker-compose.yml');

    await writeFileAtomic({path, text: 'services: {}'});

    equal(await readFile(path, 'utf8'), 'services: {}', 'Got the text');
    deepStrictEqual(await readdir(dir), ['docker-compose.yml'], 'One file');
  });
});

test('A failed rename keeps the old file and removes the temporary file', () => {
  return withFolder(async dir => {
    // A folder with a file in it cannot be replaced by a file
    const path = join(dir, 'networks.json');

    await mkdir(path);
    await writeFile(join(path, 'keep'), 'keep');

    const err = await rejection(writeFileAtomic({path, text: 'new'}));

    equal((err as NodeJS.ErrnoException).syscall, 'rename', 'Got the error');
    deepStrictEqual(tempFiles(dir), [], 'No temporary file stays');

    equal(await readFile(join(path, 'keep'), 'utf8'), 'keep', 'Same folder');
  });
});
