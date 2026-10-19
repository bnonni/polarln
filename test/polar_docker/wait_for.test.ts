import {equal} from 'node:assert/strict';
import {rejects} from 'node:assert/strict';
import test from 'node:test';

import {AbortWaitError} from '../../src/polar_docker/wait_for.js';
import {waitFor} from '../../src/polar_docker/wait_for.js';

test('A wait tries the check again until it passes', async () => {
  let tries = 0;

  const result = await waitFor({
    check: async () => {
      tries += 1;

      if (tries < 3) {
        throw new Error('NotYet');
      }

      return 'done';
    },
    interval: 1,
  });

  equal(result, 'done', 'Got result');
  equal(tries, 3, 'Got tries');
});

test('A wait ends with the last error after the timeout', async () => {
  await rejects(
    waitFor({
      check: () => Promise.reject(new Error('Down')),
      interval: 1,
      timeout: 5,
    }),
    new Error('Down'),
  );
});

test('An abort error ends the wait at once', async () => {
  let tries = 0;

  await rejects(
    waitFor({
      check: () => {
        tries += 1;

        return Promise.reject(new AbortWaitError('wallet-locked'));
      },
      interval: 1,
    }),
    AbortWaitError,
  );

  equal(tries, 1, 'Got 1 try');
});
