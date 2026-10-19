import {deepStrictEqual} from 'node:assert/strict';
import test from 'node:test';

import {mineBlocks} from '../../src/index.js';
import type {Polar} from '../../src/index.js';
import {fakePolar} from '../fixtures/fake_polar.js';
import {rejection} from '../fixtures/rejection.js';

const tool = 'mine_blocks';

test('A tool method posts the arguments without polar', async () => {
  const result = {
    blocksMined: 6,
    message: 'Mined',
    networkId: 4,
    nodeName: 'b',
    success: true,
  };

  const {polar, requests} = fakePolar({body: result});

  deepStrictEqual(await mineBlocks({blocks: 6, networkId: 4, polar}), result);

  deepStrictEqual(requests, [
    {
      body: {arguments: {blocks: 6, networkId: 4}, tool},
      method: 'POST',
      url: 'http://polar/api/mcp/execute',
    },
  ]);
});

const err = new Error('fetch failed');
const notFound = "Network with the id '9' was not found.";

const tests = [
  {
    args: {polar: undefined as unknown as Polar},
    description: 'A Polar bridge object is expected',
    error: [400, 'ExpectedPolarBridge', {tool}],
  },
  {
    args: fakePolar({error: err}),
    description: 'A fetch failure means that the bridge is not reachable',
    error: [503, 'FailedToConnectToPolarBridge', {err, tool}],
  },
  {
    args: fakePolar({body: {error: notFound}, status: 500}),
    description: 'A Polar tool error maps to a code',
    error: [404, 'PolarNetworkNotFound', {err: notFound, tool}],
  },
  {
    args: fakePolar({body: {error: 'Not found'}, status: 404}),
    description: 'An unknown route is an unexpected response',
    error: [
      503,
      'UnexpectedPolarBridgeResponse',
      {err: 'Not found', status: 404, tool},
    ],
  },
  {
    args: fakePolar({body: {error: {}}, status: 500}),
    description: 'An error without a message is an unexpected response',
    error: [503, 'UnexpectedPolarBridgeResponse', {err: {}, status: 500, tool}],
  },
  {
    args: fakePolar({body: 'not json'}),
    description: 'A response that is not JSON is an unexpected response',
    error: [
      503,
      'UnexpectedPolarBridgeResponse',
      {err: undefined, status: 200, tool},
    ],
  },
];

tests.forEach(({args, description, error}) => {
  test(description, async () => {
    deepStrictEqual(
      await rejection(mineBlocks({networkId: 4, polar: args.polar})),
      error,
    );
  });
});

test('A tool method runs the tool on a Docker backend', async () => {
  const calls: [string, object][] = [];

  const polar = {
    dataDir: '/data',
    execute: async (name: string, args: object) => {
      calls.push([name, args]);

      return {blocksMined: 1};
    },
  };

  deepStrictEqual(await mineBlocks({networkId: 4, polar}), {blocksMined: 1});

  deepStrictEqual(calls, [[tool, {networkId: 4}]]);
});
