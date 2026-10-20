import {deepStrictEqual} from 'node:assert/strict';
import test from 'node:test';

import {listTools} from '../../src/index.js';
import bundledTools from '../../src/polar_cli/bundled_tools.js';
import {fakePolar} from '../fixtures/fake_polar.js';
import {rejection} from '../fixtures/rejection.js';

const fixture = {tools: bundledTools};

test('The tools come from a GET request', async () => {
  const {polar, requests} = fakePolar({body: fixture});

  deepStrictEqual(await listTools({polar}), fixture);
  deepStrictEqual(requests, [
    {body: undefined, method: 'GET', url: 'http://polar/api/mcp/tools'},
  ]);
});

test('A rejection for the tools request has no tool name', async () => {
  const err = new Error('fetch failed');

  const {polar} = fakePolar({error: err});

  deepStrictEqual(await rejection(listTools({polar})), [
    503,
    'FailedToConnectToPolarBridge',
    {err},
  ]);
});
