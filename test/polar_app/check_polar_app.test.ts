import {deepStrictEqual} from 'node:assert/strict';
import test from 'node:test';

import checkPolarApp from '../../src/polar_app/check_polar_app.js';
import type {PolarProcessScan} from '../../src/polar_app/find_polar_process.js';
import {bunRefused} from '../fixtures/fetch_errors.js';
import {nodeRefused} from '../fixtures/fetch_errors.js';
import {rejection} from '../fixtures/rejection.js';

const health = {status: 'ok', service: 'polar-mcp-bridge'};

// Get a fake fetch that records each URL
const fakeFetch = (respond: () => Promise<Response>) => {
  const urls: string[] = [];

  const fetch = async (url: string) => {
    urls.push(url);

    return respond();
  };

  return {fetch: fetch as unknown as typeof globalThis.fetch, urls};
};

const answers = () =>
  fakeFetch(async () => new Response(JSON.stringify(health)));

const refuses = (err = nodeRefused()) =>
  fakeFetch(async () => {
    throw err;
  });

// Get a fake process scan that records each call
const fakeScan = (scan: PolarProcessScan) => {
  const calls: number[] = [];

  const findProcess = async () => {
    calls.push(calls.length);

    return scan;
  };

  return {calls, findProcess};
};

test('An answer of the bridge shows that the Polar app runs', async () => {
  const {fetch, urls} = answers();
  const {calls, findProcess} = fakeScan({result: 'none'});

  deepStrictEqual(
    [
      await checkPolarApp({env: {}, fetch, findProcess}),
      await checkPolarApp({env: {POLAR_MCP_PORT: '4567'}, fetch, findProcess}),
    ],
    [
      {found: 'bridge', runs: true, url: 'http://localhost:37373'},
      {found: 'bridge', runs: true, url: 'http://localhost:4567'},
    ],
    'Got the bridge',
  );

  deepStrictEqual(
    urls,
    ['http://localhost:37373/health', 'http://localhost:4567/health'],
    'The probe uses POLAR_MCP_PORT, else 37373',
  );

  deepStrictEqual(calls, [], 'No scan ran');
});

test('After a refused connect, a Polar process shows that the app runs', async () => {
  const {findProcess} = fakeScan({pid: 42, result: 'found'});

  deepStrictEqual(
    [
      await checkPolarApp({env: {}, fetch: refuses().fetch, findProcess}),
      await checkPolarApp({
        env: {},
        fetch: refuses(bunRefused()).fetch,
        findProcess,
      }),
    ],
    [
      {found: 'process', pid: 42, runs: true},
      {found: 'process', pid: 42, runs: true},
    ],
    'Got the process',
  );
});

test('With a refused connect and no Polar process, the app does not run', async () => {
  const {calls, findProcess} = fakeScan({result: 'none'});

  deepStrictEqual(
    await checkPolarApp({env: {}, fetch: refuses().fetch, findProcess}),
    {runs: false},
    'Got no app',
  );

  deepStrictEqual(calls, [0], 'The scan ran one time');
});

test('A probe with no clear result rejects, with no scan', async () => {
  const {fetch} = fakeFetch(() => new Promise(() => {}));
  const {calls, findProcess} = fakeScan({result: 'none'});

  const err = await rejection(
    checkPolarApp({env: {}, fetch, findProcess, timeout: 20}),
  );

  deepStrictEqual(
    [(err as Error).message, ((err as Error).cause as Error).name],
    [
      'The Polar bridge check at http://localhost:37373 gave no clear result',
      'TimeoutError',
    ],
    'Got the error',
  );

  deepStrictEqual(calls, [], 'No scan ran');
});

test('A scan with no clear result rejects', async () => {
  const cause = new Error('A PID namespace hides the processes of the host');

  const {findProcess} = fakeScan({err: cause, result: 'unknown'});

  const err = await rejection(
    checkPolarApp({env: {}, fetch: refuses().fetch, findProcess}),
  );

  deepStrictEqual(
    [(err as Error).message, (err as Error).cause],
    ['The Polar process check gave no clear result', cause],
    'Got the error',
  );
});
