import {deepStrictEqual} from 'node:assert/strict';
import {strictEqual} from 'node:assert/strict';
import {createServer} from 'node:http';
import type {AddressInfo} from 'node:net';
import test from 'node:test';

import fetchJson from '../../src/polar_bridge/fetch_json.js';
import {rejection} from '../fixtures/rejection.js';

const url = 'http://polar/x';

// Get a fetch that ignores the signal and gives a body that does not end
const stalledBodyFetch = () => {
  const inits: (RequestInit | undefined)[] = [];

  const fetch = async (_url: string, init?: RequestInit) => {
    inits.push(init);

    const body = new ReadableStream<Uint8Array>({
      start: controller => {
        controller.enqueue(new TextEncoder().encode('{"tools":'));
      },
    });

    return new Response(body, {status: 200});
  };

  return {fetch: fetch as unknown as typeof globalThis.fetch, inits};
};

test('The answer has the JSON body and the status', async () => {
  const answers = [
    new Response(JSON.stringify({a: 1})),
    new Response(JSON.stringify({error: 'x'}), {status: 404}),
    new Response('ok'),
  ];

  const results = [];

  for (const answer of answers) {
    const fetch = (async () => answer) as unknown as typeof globalThis.fetch;

    results.push(await fetchJson({fetch, init: {method: 'GET'}, url}));
  }

  deepStrictEqual(
    results,
    [
      {json: {a: 1}, ok: true, status: 200},
      {json: {error: 'x'}, ok: false, status: 404},
      {json: undefined, ok: true, status: 200},
    ],
    'Got the JSON, or undefined for a body that is not JSON',
  );
});

test('With no timeout, the request has no signal', async () => {
  const inits: (RequestInit | undefined)[] = [];

  const fetch = (async (_url: string, init?: RequestInit) => {
    inits.push(init);

    return new Response('{}');
  }) as unknown as typeof globalThis.fetch;

  await fetchJson({fetch, init: {method: 'GET'}, url});

  deepStrictEqual(inits, [{method: 'GET'}], 'Got the options as they are');
});

test('A body that does not end gives a TimeoutError', async () => {
  const {fetch, inits} = stalledBodyFetch();

  const start = performance.now();

  const err = await rejection(
    fetchJson({fetch, init: {method: 'GET'}, timeout: 20, url}),
  );

  strictEqual((err as Error).name, 'TimeoutError', 'Got the timeout');
  strictEqual(performance.now() - start < 1000, true, 'The wait ends early');
  strictEqual(inits[0]?.signal instanceof AbortSignal, true, 'Got a signal');
});

test('A server that stops in the body gives a TimeoutError', async () => {
  // The headers and a part of the body come, and then the server stops
  const server = createServer((_req, res) => {
    res.writeHead(200, {'content-type': 'application/json'});
    res.write('{"tools":');
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));

  const {port} = server.address() as AddressInfo;

  try {
    const err = await rejection(
      fetchJson({
        fetch: globalThis.fetch,
        init: {method: 'GET'},
        timeout: 100,
        url: `http://127.0.0.1:${port}/api/mcp/tools`,
      }),
    );

    strictEqual((err as Error).name, 'TimeoutError', 'Got the timeout');
  } finally {
    server.closeAllConnections();

    await new Promise(resolve => server.close(resolve));
  }
});

test('A fetch that throws at once leaves no timeout rejection', async () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (err: unknown) => unhandled.push(err);
  const err = new Error('InvalidRequest');

  const fetch = (() => {
    throw err;
  }) as unknown as typeof globalThis.fetch;

  process.on('unhandledRejection', onUnhandled);

  try {
    strictEqual(
      await rejection(fetchJson({fetch, init: {}, timeout: 10, url})),
      err,
      'Got the fetch error',
    );

    // Wait for the end of the timeout
    await new Promise(resolve => setTimeout(resolve, 50));
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }

  deepStrictEqual(unhandled, [], 'The timeout gives no unhandled rejection');
});
