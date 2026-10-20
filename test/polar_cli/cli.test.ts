import {execFile} from 'node:child_process';
import {strictEqual} from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

import packageJson from '../../package.json' with {type: 'json'};

const entry = fileURLToPath(new URL('../../src/cli.ts', import.meta.url));

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
        env: {
          ...process.env,
          POLARLN_BACKEND: 'docker',
          POLARLN_DATA_DIR: dataDir,
        },
        timeout: 10_000,
      },
    );

    strictEqual(stdout, '{\n  "networks": []\n}\n');
  } finally {
    await rm(dataDir, {force: true, recursive: true});
  }
});
