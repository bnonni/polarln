#!/usr/bin/env node
import {readFile} from 'node:fs/promises';

import {runCli} from './polar_cli/index.js';

const packagePath = new URL('../package.json', import.meta.url);

const {version} = JSON.parse(await readFile(packagePath, 'utf8'));

process.exitCode = await runCli({
  argv: process.argv.slice(2),
  stderr: text => process.stderr.write(text),
  stdout: text => process.stdout.write(text),
  version,
});
