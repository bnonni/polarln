import {deepStrictEqual} from 'node:assert/strict';
import {throws} from 'node:assert/strict';
import test from 'node:test';

import selectBackend from '../../src/polar_cli/select_backend.js';

const allowed = ['bridge', 'docker'];

const tests: {
  description: string;
  env?: {[name: string]: string};
  error?: unknown[];
  expected?: {backend: string; from: string};
  values?: {[flag: string]: boolean | string};
}[] = [
  {
    description: 'No flag and no environment variable give the bridge',
    expected: {backend: 'bridge', from: 'default'},
  },
  {
    description: 'POLARLN_BACKEND selects the backend',
    env: {POLARLN_BACKEND: 'docker'},
    expected: {backend: 'docker', from: 'POLARLN_BACKEND'},
  },
  {
    description: 'An empty POLARLN_BACKEND is the same as no value',
    env: {POLARLN_BACKEND: ''},
    expected: {backend: 'bridge', from: 'default'},
  },
  {
    description: 'The --backend flag selects the backend',
    expected: {backend: 'docker', from: '--backend'},
    values: {backend: 'docker'},
  },
  {
    description: 'An empty --backend flag is the same as no value',
    env: {POLARLN_BACKEND: 'docker'},
    expected: {backend: 'docker', from: 'POLARLN_BACKEND'},
    values: {backend: ''},
  },
  {
    description: 'The flag comes before the environment variable',
    env: {POLARLN_BACKEND: 'docker'},
    expected: {backend: 'bridge', from: '--backend'},
    values: {backend: 'bridge'},
  },
  {
    description: 'The flag also comes before a bad environment variable',
    env: {POLARLN_BACKEND: 'nope'},
    expected: {backend: 'docker', from: '--backend'},
    values: {backend: 'docker'},
  },
  {
    description: 'A misspelled --backend value is an error',
    error: [
      400,
      'ExpectedAllowedValueForFlag',
      {allowed, flag: '--backend', value: 'dokcer'},
    ],
    values: {backend: 'dokcer'},
  },
  {
    description: 'The --backend value is lowercase',
    error: [
      400,
      'ExpectedAllowedValueForFlag',
      {allowed, flag: '--backend', value: 'Docker'},
    ],
    values: {backend: 'Docker'},
  },
  {
    description: 'A --backend flag without a value is an error',
    error: [
      400,
      'ExpectedAllowedValueForFlag',
      {allowed, flag: '--backend', value: true},
    ],
    values: {backend: true},
  },
  {
    description: 'A bad POLARLN_BACKEND is an error',
    env: {POLARLN_BACKEND: 'polar'},
    error: [
      400,
      'ExpectedAllowedValueForEnv',
      {allowed, env: 'POLARLN_BACKEND', value: 'polar'},
    ],
  },
  {
    description: 'The bridge does not take --data-dir',
    error: [
      400,
      'UnexpectedFlagForBackend',
      {backend: 'bridge', flag: '--data-dir', from: 'default'},
    ],
    values: {'data-dir': '/x'},
  },
  {
    description: 'An empty --data-dir is also an error for the bridge',
    error: [
      400,
      'UnexpectedFlagForBackend',
      {backend: 'bridge', flag: '--data-dir', from: '--backend'},
    ],
    values: {backend: 'bridge', 'data-dir': ''},
  },
  {
    description: 'The docker backend does not take --url',
    env: {POLARLN_BACKEND: 'docker'},
    error: [
      400,
      'UnexpectedFlagForBackend',
      {backend: 'docker', flag: '--url', from: 'POLARLN_BACKEND'},
    ],
    values: {url: 'http://h:1'},
  },
  {
    description: 'The docker backend takes --data-dir',
    expected: {backend: 'docker', from: '--backend'},
    values: {backend: 'docker', 'data-dir': '/x'},
  },
];

tests.forEach(({description, env, error, expected, values}) => {
  test(description, () => {
    const args = {env: env || {}, values: values || {}};

    if (!!error) {
      throws(
        () => selectBackend(args),
        err => (deepStrictEqual(err, error), true),
      );
    } else {
      deepStrictEqual(selectBackend(args), expected);
    }
  });
});
