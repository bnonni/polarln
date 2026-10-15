import {deepStrictEqual} from 'node:assert/strict';
import {strictEqual} from 'node:assert/strict';
import test from 'node:test';

import {polarBridge} from '../../src/index.js';

const customFetch = (async () => new Response('{}')) as typeof fetch;

test('The default URL uses localhost and port 37373', () => {
  const port = process.env.POLAR_MCP_PORT;

  delete process.env.POLAR_MCP_PORT;

  const {polar} = polarBridge();

  process.env.POLAR_MCP_PORT = port;

  strictEqual(polar.url, 'http://localhost:37373');
  strictEqual(polar.fetch, globalThis.fetch);
});

test('The default URL uses the POLAR_MCP_PORT environment variable', () => {
  const port = process.env.POLAR_MCP_PORT;

  process.env.POLAR_MCP_PORT = '40000';

  const {polar} = polarBridge({});

  if (port === undefined) {
    delete process.env.POLAR_MCP_PORT;
  } else {
    process.env.POLAR_MCP_PORT = port;
  }

  strictEqual(polar.url, 'http://localhost:40000');
});

test('A custom URL and fetch are used', () => {
  const {polar} = polarBridge({fetch: customFetch, url: 'http://host:1//'});

  deepStrictEqual(polar, {fetch: customFetch, url: 'http://host:1'});
});
