import {deepStrictEqual} from 'node:assert/strict';
import {throws} from 'node:assert/strict';
import test from 'node:test';

import type {PolarTool} from '../../src/index.js';
import parseFlags from '../../src/polar_cli/parse_flags.js';

const tool: PolarTool = {
  description: 'Test tool',
  inputSchema: {
    properties: {
      count: {type: 'integer'},
      label: {type: 'string'},
      options: {type: 'object'},
    },
    required: ['label'],
    type: 'object',
  },
  name: 'test_tool',
};

test('Flags give typed arguments', () => {
  const argv = ['--count', '3', '--label', ' 7 ', '--options', '{"a":1}'];

  deepStrictEqual(parseFlags({argv, tool}), {
    args: {count: 3, label: ' 7 ', options: {a: 1}},
    help: false,
  });
});

test('Global flags are not tool arguments', () => {
  const argv = ['--label', 'a', '--backend', 'docker', '--data-dir', '/x'];

  deepStrictEqual(parseFlags({argv, tool}), {args: {label: 'a'}, help: false});
});

test('Help does not need the required flags', () => {
  deepStrictEqual(parseFlags({argv: ['-h', '--url', 'http://h:1'], tool}), {
    args: {},
    help: true,
  });
});

const tests = [
  {
    argv: ['--label', 'a', '--count', '1.5'],
    description: 'An integer flag needs an integer',
    error: [
      400,
      'ExpectedNumberForFlag',
      {flag: '--count', type: 'integer', value: '1.5'},
    ],
  },
  {
    argv: ['--label', 'a', '--count', ''],
    description: 'A number flag needs a value',
    error: [
      400,
      'ExpectedNumberForFlag',
      {flag: '--count', type: 'integer', value: ''},
    ],
  },
  {
    argv: ['--label', 'a', '--options', '[1]'],
    description: 'An object flag needs a JSON object',
    error: [
      400,
      'ExpectedJsonForFlag',
      {flag: '--options', type: 'object', value: '[1]'},
    ],
  },
  {
    argv: ['--label', 'a', '--options', 'nope'],
    description: 'A JSON flag needs valid JSON',
    error: [
      400,
      'ExpectedJsonForFlag',
      {flag: '--options', type: 'object', value: 'nope'},
    ],
  },
];

tests.forEach(({argv, description, error}) => {
  test(description, () => {
    throws(
      () => parseFlags({argv, tool}),
      (err: unknown) => {
        deepStrictEqual(err, error);

        return true;
      },
    );
  });
});
