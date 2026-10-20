import {strictEqual} from 'node:assert/strict';
import test from 'node:test';

import asError from '../../src/polar_docker/as_error.js';

const cycle: {[key: string]: unknown} = {};

cycle.self = cycle;

const tests: {description: string; err: unknown; expected: string}[] = [
  {
    description: 'A PolarError tuple gives its message and its details',
    err: [409, 'NetworksFileBusy', {dataDir: '/data'}],
    expected: 'NetworksFileBusy: {"dataDir":"/data"}',
  },
  {
    description: 'An Error object in the details gives its message',
    err: [
      503,
      'FailedToCheckPolarApp',
      {dataDir: '/data', err: new Error('e')},
    ],
    expected: 'FailedToCheckPolarApp: {"dataDir":"/data","err":"e"}',
  },
  {
    description: 'A tuple with no details gives its message',
    err: [400, 'ExpectedNode'],
    expected: 'ExpectedNode',
  },
  {
    description: 'A bigint in the details gives its text',
    err: [500, 'Failed', {count: 1n}],
    expected: 'Failed: {"count":"1"}',
  },
  {
    description: 'Details that JSON cannot show give only the message',
    err: [500, 'Failed', cycle],
    expected: 'Failed',
  },
  {
    description: 'A string stays the same',
    err: 'failed',
    expected: 'failed',
  },
  {
    description: 'An object that is not an Error gives its JSON',
    err: {code: 1, message: 'Command failed'},
    expected: '{"code":1,"message":"Command failed"}',
  },
  {
    description: 'A value that JSON cannot show gives its text',
    err: undefined,
    expected: 'undefined',
  },
];

tests.forEach(({description, err, expected}) => {
  test(description, () => {
    const error = asError(err);

    strictEqual(error instanceof Error, true);
    strictEqual(error.message, expected);
  });
});

test('An Error object stays the same', () => {
  const err = new Error('up failed');

  strictEqual(asError(err), err);
  strictEqual(asError(err).message, 'up failed');
});
