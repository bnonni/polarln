// Compare the tools of the running Polar app with the test fixture.
// Run: pnpm check-tools. Exit code 1 means that Polar changed a tool.
import {readFile} from 'node:fs/promises';

import {listTools} from '../src/index.js';
import {polarBridge} from '../src/index.js';
import type {PolarTool} from '../src/index.js';

const fixturePath = new URL('../test/fixtures/tools.json', import.meta.url);

const shapeOf = (tool: PolarTool) =>
  JSON.stringify({
    properties: tool.inputSchema.properties,
    required: [...(tool.inputSchema.required || [])].sort(),
  });

const {polar} = polarBridge({});

const live = await listTools({polar});
const known: {tools: PolarTool[]} = JSON.parse(
  await readFile(fixturePath, 'utf8'),
);

const knownByName = new Map(known.tools.map(tool => [tool.name, tool]));
const liveByName = new Map(live.tools.map(tool => [tool.name, tool]));

const added = live.tools.filter(({name}) => !knownByName.has(name));
const removed = known.tools.filter(({name}) => !liveByName.has(name));
const changed = live.tools.filter(tool => {
  const knownTool = knownByName.get(tool.name);

  return !!knownTool && shapeOf(knownTool) !== shapeOf(tool);
});

added.forEach(({name}) => console.log(`added: ${name}`));
removed.forEach(({name}) => console.log(`removed: ${name}`));
changed.forEach(({name}) => console.log(`changed arguments: ${name}`));

if (!added.length && !removed.length && !changed.length) {
  console.log(`no change: ${live.tools.length} tools`);
} else {
  console.log(
    'Update the method types, then copy the live tools to the fixture.',
  );
  process.exitCode = 1;
}
