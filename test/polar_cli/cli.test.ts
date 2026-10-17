import {execFile} from 'node:child_process';
import {strictEqual} from 'node:assert/strict';
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
