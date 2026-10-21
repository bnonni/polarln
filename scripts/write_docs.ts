// Write the command reference in docs/commands. Run: pnpm write-docs.
//
// The script writes docs/commands/README.md in full. In each command page, it
// replaces only the generated region, so the notes after the region stay. A
// page that is not there gets the region and an empty notes section. The
// script deletes no file: it shows a warning for a page with no command.
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {readdir} from 'node:fs/promises';
import {readFile} from 'node:fs/promises';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

import {beginMarker} from './command_docs.js';
import {commandDocs} from './command_docs.js';
import {commandRegion} from './command_docs.js';
import {commandsIndex} from './command_docs.js';
import {endMarker} from './command_docs.js';
import {newCommandPage} from './command_docs.js';
import {replaceRegion} from './command_docs.js';

const folder = fileURLToPath(new URL('../docs/commands', import.meta.url));
const indexName = 'README.md';

// Write a file only if its text changes
const writeChanged = async (path: string, text: string) => {
  const old = existsSync(path) ? await readFile(path, 'utf8') : undefined;

  if (old === text) {
    return false;
  }

  await writeFile(path, text);

  return true;
};

const docs = commandDocs();
const pages = docs.map(({command}) => `${command}.md`);

await mkdir(folder, {recursive: true});

let changed = 0;
let failed = 0;

for (const doc of docs) {
  const path = join(folder, `${doc.command}.md`);

  if (!existsSync(path)) {
    await writeFile(path, newCommandPage(doc));

    changed += 1;

    continue;
  }

  const page = replaceRegion({
    page: await readFile(path, 'utf8'),
    region: commandRegion(doc),
  });

  if (page === undefined) {
    console.error(
      `Error: ${path} must have one "${beginMarker}" line, then one ` +
        `"${endMarker}" line. The page did not change.`,
    );

    failed += 1;

    continue;
  }

  if (await writeChanged(path, page)) {
    changed += 1;
  }
}

if (await writeChanged(join(folder, indexName), commandsIndex())) {
  changed += 1;
}

const others = (await readdir(folder)).filter(name => {
  return name.endsWith('.md') && name !== indexName && !pages.includes(name);
});

others.forEach(name => {
  console.warn(
    `Warning: ${join(folder, name)} is not the page of a command. ` +
      'Delete it, or move its text to a command page.',
  );
});

console.log(`${changed} files changed in ${folder}.`);

if (!!failed) {
  process.exitCode = 1;
}
