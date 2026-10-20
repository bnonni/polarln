import {deepStrictEqual} from 'node:assert/strict';
import {strictEqual} from 'node:assert/strict';
import {createServer} from 'node:http';
import type {AddressInfo} from 'node:net';
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

test('A tools request with a timeout ends if the bridge does not answer', async () => {
  const signals: unknown[] = [];

  // A bridge that accepts the connect and never answers
  const polar = {
    fetch: ((_url: string, init?: RequestInit) => {
      signals.push(init?.signal);

      return new Promise(() => {});
    }) as unknown as typeof fetch,
    url: 'http://polar',
  };

  const start = performance.now();

  const err = await rejection(listTools({polar, timeout: 20}));

  const [code, message, details] = err as [number, string, {err: Error}];

  deepStrictEqual(
    [code, message, details.err.name],
    [503, 'FailedToConnectToPolarBridge', 'TimeoutError'],
    'Got the timeout',
  );

  strictEqual(performance.now() - start < 1000, true, 'The wait ends early');
  strictEqual(signals[0] instanceof AbortSignal, true, 'Got a signal');
});

test('A tools request with a timeout ends if the body does not end', async () => {
  // A fetch that ignores the signal, and a body that does not end
  const polar = {
    fetch: (async () => {
      const body = new ReadableStream<Uint8Array>({
        start: controller => {
          controller.enqueue(new TextEncoder().encode('{"tools":'));
        },
      });

      return new Response(body, {status: 200});
    }) as unknown as typeof fetch,
    url: 'http://polar',
  };

  const start = performance.now();

  const err = await rejection(listTools({polar, timeout: 20}));

  const [code, message, details] = err as [number, string, {err: Error}];

  deepStrictEqual(
    [code, message, details.err.name],
    [503, 'FailedToConnectToPolarBridge', 'TimeoutError'],
    'Got the timeout',
  );

  strictEqual(performance.now() - start < 1000, true, 'The wait ends early');
});

test('A server that stops in the body gives a connect failure', async () => {
  // The headers and a part of the body come, and then the server stops
  const server = createServer((_req, res) => {
    res.writeHead(200, {'content-type': 'application/json'});
    res.write('{"tools":');
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));

  const {port} = server.address() as AddressInfo;

  const polar = {fetch: globalThis.fetch, url: `http://127.0.0.1:${port}`};

  try {
    const err = await rejection(listTools({polar, timeout: 100}));

    const [code, message, details] = err as [number, string, {err: Error}];

    deepStrictEqual(
      [code, message, details.err.name],
      [503, 'FailedToConnectToPolarBridge', 'TimeoutError'],
      'Got the timeout, not an unexpected answer',
    );
  } finally {
    server.closeAllConnections();

    await new Promise(resolve => server.close(resolve));
  }
});

test('A tools request with no timeout sends no signal', async () => {
  const inits: (RequestInit | undefined)[] = [];

  const polar = {
    fetch: (async (_url: string, init?: RequestInit) => {
      inits.push(init);

      return new Response(JSON.stringify(fixture));
    }) as unknown as typeof fetch,
    url: 'http://polar',
  };

  deepStrictEqual(await listTools({polar}), fixture);
  deepStrictEqual(inits, [{method: 'GET'}]);
});

test('A fetch that throws at once leaves no timeout rejection', async () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (err: unknown) => unhandled.push(err);
  const err = new Error('InvalidRequest');

  // A custom fetch can throw before it returns a promise
  const polar = {
    fetch: (() => {
      throw err;
    }) as unknown as typeof fetch,
    url: 'http://polar',
  };

  process.on('unhandledRejection', onUnhandled);

  try {
    deepStrictEqual(await rejection(listTools({polar, timeout: 10})), [
      503,
      'FailedToConnectToPolarBridge',
      {err},
    ]);

    // Wait for the end of the timeout
    await new Promise(resolve => setTimeout(resolve, 50));
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }

  deepStrictEqual(unhandled, [], 'The timeout gives no unhandled rejection');
});
