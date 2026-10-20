import {deepStrictEqual} from 'node:assert/strict';
import {equal} from 'node:assert/strict';
import {ok} from 'node:assert/strict';
import {createServer} from 'node:http';
import type {AddressInfo} from 'node:net';
import test from 'node:test';

import probeBridge from '../../src/polar_app/probe_bridge.js';
import {aggregateMixed} from '../fixtures/fetch_errors.js';
import {aggregateRefused} from '../fixtures/fetch_errors.js';
import {bunRefused} from '../fixtures/fetch_errors.js';
import {nodeNotFound} from '../fixtures/fetch_errors.js';
import {nodeRefused} from '../fixtures/fetch_errors.js';

const health = {status: 'ok', service: 'polar-mcp-bridge'};

type Request = {method?: string; url: string};

// Get a fake fetch that records each request
const fakeFetch = (respond: () => Promise<Response>) => {
  const requests: Request[] = [];

  const fetch = async (url: string, init?: RequestInit) => {
    requests.push({method: init?.method, url});

    return respond();
  };

  return {fetch: fetch as unknown as typeof globalThis.fetch, requests};
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {status});

test('The Polar health answer shows that the bridge answers', async () => {
  const {fetch, requests} = fakeFetch(async () => json(health));

  deepStrictEqual(
    [
      await probeBridge({fetch, url: 'http://localhost:4000'}),
      await probeBridge({fetch, url: 'http://localhost:4000/'}),
    ],
    [{result: 'answers'}, {result: 'answers'}],
    'Got an answer',
  );

  deepStrictEqual(
    requests,
    [
      {method: 'GET', url: 'http://localhost:4000/health'},
      {method: 'GET', url: 'http://localhost:4000/health'},
    ],
    'Got the health path',
  );
});

test('The refused connect errors of bun and Node give refused', async () => {
  const errors = [bunRefused(), nodeRefused(), aggregateRefused()];

  const results = [];

  for (const err of errors) {
    const {fetch} = fakeFetch(async () => {
      throw err;
    });

    results.push(await probeBridge({fetch, url: 'http://localhost:4000'}));
  }

  deepStrictEqual(
    results,
    [{result: 'refused'}, {result: 'refused'}, {result: 'refused'}],
    'Got refused for each shape',
  );
});

test('A fetch that does not end gives unknown after the timeout', async () => {
  const {fetch} = fakeFetch(() => new Promise(() => {}));

  const start = Date.now();

  const probe = await probeBridge({
    fetch,
    timeout: 20,
    url: 'http://localhost:4000',
  });

  equal(probe.result, 'unknown', 'Got unknown');

  const {err} = probe as {err: Error};

  equal(err.name, 'TimeoutError', 'Got the timeout');
  ok(Date.now() - start < 1000, 'The probe ends after the short timeout');
});

test('A different answer gives unknown', async () => {
  const answers = [
    () => json({status: 'ok'}),
    () => json({service: 'polar-mcp-bridge'}, 404),
    () => json([health]),
    () => new Response('ok'),
  ];

  const results = [];

  for (const answer of answers) {
    const {fetch} = fakeFetch(async () => answer());

    const probe = await probeBridge({fetch, url: 'http://localhost:4000'});

    results.push([probe.result, (probe as {err: Error}).err.message]);
  }

  const message = (status: number) =>
    `The answer of http://localhost:4000/health is not from the Polar bridge (HTTP ${status})`;

  deepStrictEqual(
    results,
    [
      ['unknown', message(200)],
      ['unknown', message(404)],
      ['unknown', message(200)],
      ['unknown', message(200)],
    ],
    'Got unknown for each answer',
  );
});

test('A bad URL and other connect errors give unknown', async () => {
  const results = [
    await probeBridge({url: 'http://localhost:abc'}),
    await probeBridge({url: 'not a url'}),
  ];

  for (const err of [aggregateMixed(), nodeNotFound(), new Error('x')]) {
    const {fetch} = fakeFetch(async () => {
      throw err;
    });

    results.push(await probeBridge({fetch, url: 'http://localhost:4000'}));
  }

  deepStrictEqual(
    results.map(n => n.result),
    ['unknown', 'unknown', 'unknown', 'unknown', 'unknown'],
    'Got unknown for each error',
  );
});

test('The probe gets the answer of a real server, then a refusal', async () => {
  const server = createServer((req, res) => {
    const found = req.method === 'GET' && req.url === '/health';

    res.writeHead(found ? 200 : 404, {'content-type': 'application/json'});
    res.end(JSON.stringify(found ? health : {error: 'Not found'}));
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));

  const {port} = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;

  const answer = await probeBridge({url});

  server.closeAllConnections();

  await new Promise(resolve => server.close(resolve));

  deepStrictEqual(
    [answer, await probeBridge({url})],
    [{result: 'answers'}, {result: 'refused'}],
    'Got the answer and then the refusal of this runtime',
  );
});
