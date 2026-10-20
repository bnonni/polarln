import {deepStrictEqual} from 'node:assert/strict';
import {strictEqual} from 'node:assert/strict';
import test from 'node:test';

import bundledTools from '../../src/polar_cli/bundled_tools.js';
import {flagName} from '../../src/polar_cli/names.js';
import {globalOptions} from '../../src/polar_cli/parse_flags.js';

test('The bundled tools have unique names and valid schemas', () => {
  const names = bundledTools.map(({name}) => name);

  strictEqual(names.length, 48);
  strictEqual(new Set(names).size, names.length);

  bundledTools.forEach(({inputSchema, name}) => {
    const properties = Object.keys(inputSchema.properties);
    const required = inputSchema.required || [];

    strictEqual(inputSchema.type, 'object', name);
    deepStrictEqual(
      required.filter(key => !properties.includes(key)),
      [],
      `${name} requires only its arguments`,
    );
  });
});

test('No tool flag uses the name of a global flag', () => {
  const globalFlags = Object.keys(globalOptions);

  bundledTools.forEach(({inputSchema, name}) => {
    const flags = Object.keys(inputSchema.properties).map(flagName);

    deepStrictEqual(
      flags.filter(flag => globalFlags.includes(flag)),
      [],
      name,
    );
  });
});
