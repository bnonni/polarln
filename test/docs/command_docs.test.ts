import {deepStrictEqual} from 'node:assert/strict';
import {strictEqual} from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFileSync} from 'node:fs';
import {readdirSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {commandDocs} from '../../scripts/command_docs.js';
import {commandRegion} from '../../scripts/command_docs.js';
import {commandsIndex} from '../../scripts/command_docs.js';
import {exampleArgs} from '../../scripts/command_docs.js';
import {exampleArgv} from '../../scripts/command_docs.js';
import {regionOf} from '../../scripts/command_docs.js';
import {replaceRegion} from '../../scripts/command_docs.js';
import * as sdk from '../../src/index.js';
import bundledTools from '../../src/polar_cli/bundled_tools.js';
import localTools from '../../src/polar_cli/local_tools.js';
import {commandName} from '../../src/polar_cli/names.js';
import parseFlags from '../../src/polar_cli/parse_flags.js';

const folder = fileURLToPath(new URL('../../docs/commands', import.meta.url));
const hint = 'Run pnpm write-docs, then commit the changed pages';

const docs = commandDocs();

test('The docs have each command of the CLI once', () => {
  const commands = [...bundledTools, ...localTools].map(({name}) => {
    return commandName(name);
  });

  deepStrictEqual(
    docs.map(({command}) => command).sort(),
    [...new Set(commands)].sort(),
  );
});

test('Each command page has the current generated region', () => {
  docs.forEach(doc => {
    const path = join(folder, `${doc.command}.md`);

    strictEqual(existsSync(path), true, `${path} is missing. ${hint}`);

    const region = regionOf(readFileSync(path, 'utf8'));

    strictEqual(region, commandRegion(doc), `${path} is old. ${hint}`);
  });
});

test('The command index is current', () => {
  const path = join(folder, 'README.md');

  strictEqual(readFileSync(path, 'utf8'), commandsIndex(), hint);
});

test('No page exists for an unknown command', () => {
  const pages = docs.map(({command}) => `${command}.md`);

  const others = readdirSync(folder).filter(name => {
    return name !== 'README.md' && !pages.includes(name);
  });

  deepStrictEqual(others, [], 'Delete the pages of unknown commands');
});

test('Each example gives valid flags to the CLI', () => {
  docs.forEach(doc => {
    const {args} = parseFlags({argv: exampleArgv(doc), tool: doc.tool});

    deepStrictEqual(args, exampleArgs(doc), doc.command);
  });
});

test('Each command has its SDK method', () => {
  const methods: {[name: string]: unknown} = sdk;

  docs.forEach(doc => {
    strictEqual(typeof methods[doc.method], 'function', doc.method);
  });
});

test('A region replace keeps the text around the region', () => {
  const region = commandRegion(docs[0]);
  const [begin, end] = [region.split('\n')[0], region.split('\n').at(-1)];

  const page = ['Before', begin, 'Old', end, '', '## Notes', ''].join('\n');

  strictEqual(
    replaceRegion({page, region}),
    ['Before', region, '', '## Notes', ''].join('\n'),
  );

  strictEqual(replaceRegion({page: 'No region\n', region}), undefined);
  strictEqual(replaceRegion({page: `${page}${page}`, region}), undefined);
});
