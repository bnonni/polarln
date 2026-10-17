import {deepStrictEqual} from 'node:assert/strict';
import {strictEqual} from 'node:assert/strict';
import test from 'node:test';

import {runCli} from '../../src/polar_cli/index.js';
import {fakePolar} from '../fixtures/fake_polar.js';
import type {FakeRequest} from '../fixtures/fake_polar.js';
import fixture from '../fixtures/tools.json' with {type: 'json'};

const notFound = "Network with the id '9' was not found.";

// The fake bridge gives the fixture tools and a result for each tool call
const bridge = ({method}: FakeRequest) => {
  return method === 'GET' ? {body: fixture} : {body: {success: true}};
};

// Get the bodies of the tool calls
const executed = (requests: FakeRequest[]) => {
  return requests.filter(({method}) => method === 'POST').map(({body}) => body);
};

// Run the command line with a fake bridge
const run = async (
  argv: string[],
  fake: Parameters<typeof fakePolar>[0] = {respond: bridge},
) => {
  const {polar, requests} = fakePolar(fake);
  const stderr: string[] = [];
  const stdout: string[] = [];

  const code = await runCli({
    argv,
    fetch: polar.fetch,
    stderr: text => stderr.push(text),
    stdout: text => stdout.push(text),
    version: '1.2.3',
  });

  return {code, requests, stderr: stderr.join(''), stdout: stdout.join('')};
};

test('A command runs its tool with the flags as typed arguments', async () => {
  const {code, requests, stderr, stdout} = await run([
    'open-channel',
    '--network-id',
    '4',
    '--from-node',
    'alice',
    '--to-node',
    'bob',
    '--sats',
    '250000',
    '--is-private',
    '--no-auto-fund',
  ]);

  strictEqual(code, 0);
  strictEqual(stderr, '');
  strictEqual(stdout, '{\n  "success": true\n}\n');

  deepStrictEqual(executed(requests), [
    {
      arguments: {
        autoFund: false,
        fromNode: 'alice',
        isPrivate: true,
        networkId: 4,
        sats: 250000,
        toNode: 'bob',
      },
      tool: 'open_channel',
    },
  ]);
});

test('A JSON flag gives an array argument', async () => {
  const nodes = [{count: 2, implementation: 'litd'}];

  const {code, requests} = await run([
    'create-network',
    '--name',
    'test',
    '--nodes',
    JSON.stringify(nodes),
  ]);

  strictEqual(code, 0);

  deepStrictEqual(executed(requests), [
    {arguments: {name: 'test', nodes}, tool: 'create_network'},
  ]);
});

test('The --url flag sets the bridge URL', async () => {
  const {code, requests} = await run(['list-networks', '--url', 'http://h:1']);

  strictEqual(code, 0);

  deepStrictEqual(
    requests.map(({url}) => url),
    ['http://h:1/api/mcp/tools', 'http://h:1/api/mcp/execute'],
  );
});

test('A tool failure gives exit code 1 and a rejection line', async () => {
  const {code, stderr, stdout} = await run(
    ['get-node-info', '--network-id', '9', '--node-name', 'alice'],
    {
      respond: request => {
        if (request.method === 'GET') {
          return {body: fixture};
        }

        return {body: {error: notFound}, status: 500};
      },
    },
  );

  strictEqual(code, 1);
  strictEqual(stdout, '');

  deepStrictEqual(JSON.parse(stderr), [
    404,
    'PolarNetworkNotFound',
    {err: notFound, tool: 'get_node_info'},
  ]);
});

test('A bridge that does not run gives exit code 1', async () => {
  const {code, stderr} = await run(['list-networks'], {
    error: new Error('fetch failed', {cause: new Error('ECONNREFUSED')}),
  });

  strictEqual(code, 1);

  deepStrictEqual(JSON.parse(stderr), [
    503,
    'FailedToConnectToPolarBridge',
    {err: {cause: {message: 'ECONNREFUSED'}, message: 'fetch failed'}},
  ]);
});

test('get-node-credentials runs in polarln, not as a tool', async () => {
  const {code, requests, stderr} = await run(
    ['get-node-credentials', '--network-id', '4', '--node-name', 'alice'],
    {
      respond: request => {
        return {body: request.method === 'GET' ? fixture : {networks: []}};
      },
    },
  );

  strictEqual(code, 1);

  deepStrictEqual(executed(requests), [{arguments: {}, tool: 'list_networks'}]);

  deepStrictEqual(JSON.parse(stderr), [
    404,
    'PolarNetworkNotFound',
    {networkId: 4},
  ]);
});

const usageTests = [
  {
    argv: ['get-node-info', '--network-id', '4'],
    description: 'A required flag is expected',
    error: [400, 'MissingRequiredFlags', {flags: ['--node-name']}],
  },
  {
    argv: ['get-node-info', '--network-id', 'x', '--node-name', 'a'],
    description: 'A number flag needs a number',
    error: [
      400,
      'ExpectedNumberForFlag',
      {flag: '--network-id', type: 'number', value: 'x'},
    ],
  },
  {
    argv: ['set-auto-mine-mode', '--network-id', '4', '--mode', '45'],
    description: 'An enum flag needs an allowed value',
    error: [
      400,
      'ExpectedAllowedValueForFlag',
      {allowed: [0, 30, 60, 300, 600], flag: '--mode', value: '45'},
    ],
  },
  {
    argv: ['create-network', '--name', 'test', '--nodes', '{}'],
    description: 'An array flag needs a JSON array',
    error: [
      400,
      'ExpectedJsonForFlag',
      {flag: '--nodes', type: 'array', value: '{}'},
    ],
  },
  {
    argv: ['get-node-info', '--bogus'],
    description: 'An unknown flag is a usage error',
    error: [400, 'InvalidFlags'],
  },
  {
    argv: ['nope'],
    description: 'An unknown command is a usage error',
    error: [400, 'UnknownCommand', {command: 'nope'}],
  },
  {
    argv: ['help', 'nope'],
    description: 'Help for an unknown command is a usage error',
    error: [400, 'UnknownCommand', {command: 'nope'}],
  },
  {
    argv: ['--url', 'http://h:1', 'list-networks'],
    description: 'The command comes before the flags',
    error: [400, 'ExpectedCommandBeforeFlags', {command: '--url'}],
  },
];

usageTests.forEach(({argv, description, error}) => {
  test(description, async () => {
    const {code, requests, stderr} = await run(argv);

    const rejection = JSON.parse(stderr);

    strictEqual(code, 2);
    deepStrictEqual(executed(requests), []);
    deepStrictEqual(
      error.length === 2 ? rejection.slice(0, 2) : rejection,
      error,
    );
  });
});

test('No command shows the commands', async () => {
  const {code, stdout} = await run([]);

  strictEqual(code, 0);
  strictEqual(stdout.startsWith('Usage: polarln <command> [flags]\n'), true);
  strictEqual(stdout.includes('\n  open-channel '), true);
  strictEqual(stdout.includes('\n  get-node-credentials '), true);

  strictEqual((await run(['--help'])).stdout, stdout);
});

test('Command help shows the flags of the tool', async () => {
  const {code, stdout} = await run(['open-channel', '--help']);

  strictEqual(code, 0);
  strictEqual(stdout.includes('--network-id <number>  (required) ID'), true);
  strictEqual(stdout.includes('Use --no-auto-fund for false.'), true);
  strictEqual(stdout.includes('--no-is-private'), false);

  strictEqual((await run(['help', 'open-channel'])).stdout, stdout);
});

test('--version shows the version without the bridge', async () => {
  const {code, requests, stdout} = await run(['--version']);

  strictEqual(code, 0);
  strictEqual(stdout, '1.2.3\n');
  deepStrictEqual(requests, []);
});
