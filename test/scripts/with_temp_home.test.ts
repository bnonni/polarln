import {deepStrictEqual} from 'node:assert/strict';
import {equal} from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {readFileSync} from 'node:fs';
import {readdirSync} from 'node:fs';
import {mkdtemp} from 'node:fs/promises';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname} from 'node:path';
import {join} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const script = fileURLToPath(
  new URL('../../scripts/with_temp_home.sh', import.meta.url),
);

// Run the script with a command that writes its HOME path to a file, in a
// new temporary directory
const runWithTempHome = async (exitCode: number) => {
  const tmp = await mkdtemp(join(tmpdir(), 'polarln-temp-home-'));
  const out = join(tmp, 'home.txt');

  try {
    const {status} = spawnSync(
      'sh',
      [
        script,
        'sh',
        '-c',
        'printf %s "$HOME" > "$0" && test -d "$HOME" && exit "$1"',
        out,
        String(exitCode),
      ],
      {env: {...process.env, TMPDIR: tmp}},
    );

    const home = readFileSync(out, 'utf8');

    return {
      entries: readdirSync(tmp),
      home,
      homeStays: existsSync(home),
      status,
      tmp,
    };
  } finally {
    await rm(tmp, {force: true, recursive: true});
  }
};

test('The command gets a new HOME folder, and the folder goes away', async () => {
  const run = await runWithTempHome(0);

  equal(run.status, 0, 'The command passed');
  equal(dirname(run.home), run.tmp, 'HOME was in the temporary directory');
  equal(run.homeStays, false, 'The HOME folder went away');
  deepStrictEqual(run.entries, ['home.txt'], 'No other folder stays');
});

test('A command that fails keeps its exit code', async () => {
  const run = await runWithTempHome(3);

  equal(run.status, 3, 'Got the exit code of the command');
  equal(run.homeStays, false, 'The HOME folder went away');
  deepStrictEqual(run.entries, ['home.txt'], 'No other folder stays');
});
