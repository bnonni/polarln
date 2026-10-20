import {deepStrictEqual} from 'node:assert/strict';
import test from 'node:test';

import isConnectionRefused from '../../src/polar_app/is_connection_refused.js';
import {aggregateMixed} from '../fixtures/fetch_errors.js';
import {aggregateRefused} from '../fixtures/fetch_errors.js';
import {bunRefused} from '../fixtures/fetch_errors.js';
import {nodeNotFound} from '../fixtures/fetch_errors.js';
import {nodeRefused} from '../fixtures/fetch_errors.js';

test('The refused connect errors of bun and Node are refusals', () => {
  deepStrictEqual(
    [bunRefused(), nodeRefused(), aggregateRefused()].map(isConnectionRefused),
    [true, true, true],
    'Got a refusal for each shape',
  );
});

test('Other errors are not refusals', () => {
  const timeout = new DOMException('The operation timed out.', 'TimeoutError');

  const cycle = new Error('cycle');

  cycle.cause = cycle;

  deepStrictEqual(
    [
      aggregateMixed(),
      nodeNotFound(),
      timeout,
      new TypeError('fetch failed', {cause: new Error('ECONNREFUSED')}),
      new AggregateError([]),
      cycle,
      'ECONNREFUSED',
      undefined,
    ].map(isConnectionRefused),
    [false, false, false, false, false, false, false, false],
    'Got no refusal',
  );
});
