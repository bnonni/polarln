// Compare the tools of the running Polar app with the bundled tool schemas.
// Run: pnpm check-tools. Exit code 1 means that Polar changed a tool.
// Run: pnpm check-tools --write <Polar version> to write the live tools to
// src/polar_cli/bundled_tools.ts.
import {execFile} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

import {listTools} from '../src/index.js';
import {polarBridge} from '../src/index.js';
import type {PolarTool} from '../src/index.js';
import bundledTools from '../src/polar_cli/bundled_tools.js';

const modulePath = new URL(
  '../src/polar_cli/bundled_tools.ts',
  import.meta.url,
);
const oxfmtPath = new URL('../node_modules/.bin/oxfmt', import.meta.url);

const shapeOf = (tool: PolarTool) =>
  JSON.stringify({
    properties: tool.inputSchema.properties,
    required: [...(tool.inputSchema.required || [])].sort(),
  });

// Get the text of the bundled tools module
const moduleText = (tools: PolarTool[], version: string) =>
  [
    `// Ported from jamaljsr/polar v${version} (MIT): the names, descriptions, and`,
    '// input schemas of the MCP tools in src/store/models/mcp, in the bridge order.',
    '// Do not edit. Start Polar, then run `pnpm check-tools --write <version>`.',
    "import type {PolarTool} from '../polar_bridge/index.js';",
    '',
    `/** Tool Schemas of the Polar v${version} Bridge */`,
    `const bundledTools: PolarTool[] = ${JSON.stringify(tools, null, 2)};`,
    '',
    'export default bundledTools;',
    '',
  ].join('\n');

// Write the live tools to the bundled tools module
const write = async (tools: PolarTool[], version: string) => {
  await writeFile(modulePath, moduleText(tools, version));

  await promisify(execFile)(fileURLToPath(oxfmtPath), [
    fileURLToPath(modulePath),
  ]);

  console.log('wrote src/polar_cli/bundled_tools.ts');
};

const [flag, rawVersion] = process.argv.slice(2);

// "v4.1.0" and "4.1.0" give the same version
const version = rawVersion?.replace(/^v/, '');

if (flag !== undefined && (flag !== '--write' || !version)) {
  console.error('Usage: pnpm check-tools [--write <Polar version>]');

  process.exitCode = 2;
} else {
  const {polar} = polarBridge({});

  const live = await listTools({polar});

  const knownByName = new Map(bundledTools.map(tool => [tool.name, tool]));
  const liveByName = new Map(live.tools.map(tool => [tool.name, tool]));

  const added = live.tools.filter(({name}) => !knownByName.has(name));
  const removed = bundledTools.filter(({name}) => !liveByName.has(name));
  const changed = live.tools.filter(tool => {
    const knownTool = knownByName.get(tool.name);

    return !!knownTool && shapeOf(knownTool) !== shapeOf(tool);
  });
  const described = live.tools.filter(tool => {
    const knownTool = knownByName.get(tool.name);

    return !!knownTool && knownTool.description !== tool.description;
  });

  added.forEach(({name}) => console.log(`added: ${name}`));
  removed.forEach(({name}) => console.log(`removed: ${name}`));
  changed.forEach(({name}) => console.log(`changed arguments: ${name}`));
  described.forEach(({name}) => console.log(`changed description: ${name}`));

  const isSame =
    !added.length && !removed.length && !changed.length && !described.length;

  if (isSame) {
    console.log(`no change: ${live.tools.length} tools`);
  }

  if (!!version) {
    await write(live.tools, version);
  } else if (!isSame) {
    console.log(
      'Update the method types, then run "pnpm check-tools --write <version>".',
    );

    process.exitCode = 1;
  }
}
