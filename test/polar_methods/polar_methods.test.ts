import {deepStrictEqual} from 'node:assert/strict';
import test from 'node:test';

import * as methods from '../../src/polar_methods/index.js';
import bundledTools from '../../src/polar_cli/bundled_tools.js';
import {fakePolar} from '../fixtures/fake_polar.js';

const camelCase = (name: string) =>
  name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

test('Each Polar bridge tool has a method with the camelCase name', async () => {
  const {polar, requests} = fakePolar();

  const entries = Object.entries(methods) as [
    string,
    (args: object) => Promise<unknown>,
  ][];

  for (const [, method] of entries) {
    await method({polar});
  }

  const tools = requests.map(({body}) => (body as {tool: string}).tool);

  deepStrictEqual(
    entries.map(([name]) => name).sort(),
    tools.map(camelCase).sort(),
  );

  deepStrictEqual(tools.sort(), bundledTools.map(({name}) => name).sort());
});
