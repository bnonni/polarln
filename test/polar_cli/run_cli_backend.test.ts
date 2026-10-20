import {deepStrictEqual} from 'node:assert/strict';
import {strictEqual} from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';

import {runCli} from '../../src/polar_cli/index.js';
import type {RunCliArgs} from '../../src/polar_cli/index.js';
import {fakeDocker} from '../fixtures/fake_docker.js';
import type {FakeExecute} from '../fixtures/fake_docker.js';
import {fakePolar} from '../fixtures/fake_polar.js';

const docker = {POLARLN_BACKEND: 'docker'};
const notFound = "Network with the id '9' was not found.";

// Run the command line with a fake Docker backend and a bridge that fails
const run = async (
  argv: string[],
  args: {
    env?: {[name: string]: string};
    make?: RunCliArgs['polarDocker'];
    realDocker?: boolean;
    respond?: (call: FakeExecute) => unknown;
  } = {},
) => {
  const {polar, requests} = fakePolar({error: new Error('NoBridge')});
  const {executed, made, make} = fakeDocker({respond: args.respond});
  const stderr: string[] = [];
  const stdout: string[] = [];

  const code = await runCli({
    argv,
    env: args.env || {},
    fetch: polar.fetch,
    polarDocker: !!args.realDocker ? undefined : args.make || make,
    stderr: text => stderr.push(text),
    stdout: text => stdout.push(text),
    version: '1.2.3',
  });

  return {
    code,
    executed,
    made,
    requests,
    stderr: stderr.join(''),
    stdout: stdout.join(''),
  };
};

test('The docker backend runs a tool without the bridge', async () => {
  const {code, executed, made, requests, stderr, stdout} = await run([
    'open-channel',
    '--network-id',
    '4',
    '--from-node',
    'alice',
    '--to-node',
    'bob',
    '--sats',
    '250000',
    '--backend',
    'docker',
  ]);

  strictEqual(code, 0);
  strictEqual(stderr, '');
  strictEqual(stdout, '{\n  "success": true\n}\n');
  deepStrictEqual(requests, []);
  deepStrictEqual(made, [{dataDir: undefined}]);

  deepStrictEqual(executed, [
    {
      args: {fromNode: 'alice', networkId: 4, sats: 250000, toNode: 'bob'},
      tool: 'open_channel',
    },
  ]);
});

test('POLARLN_BACKEND selects the backend, and the flag comes first', async () => {
  const fromEnv = await run(['list-networks'], {env: docker});

  strictEqual(fromEnv.code, 0);
  deepStrictEqual(fromEnv.requests, []);
  deepStrictEqual(fromEnv.executed, [{args: {}, tool: 'list_networks'}]);

  const fromFlag = await run(['list-networks', '--backend', 'bridge'], {
    env: docker,
  });

  strictEqual(fromFlag.code, 1);
  strictEqual(fromFlag.requests.length, 1);
  deepStrictEqual(fromFlag.made, []);
  strictEqual(fromFlag.stderr.startsWith('[503,"FailedToConnect'), true);
});

test('--data-dir goes to the Docker backend', async () => {
  const {code, made} = await run([
    'list-networks',
    '--backend',
    'docker',
    '--data-dir',
    '/tmp/x',
  ]);

  strictEqual(code, 0);
  deepStrictEqual(made, [{dataDir: '/tmp/x'}]);

  const inline = await run([
    'list-networks',
    '--backend=docker',
    '--data-dir=-x',
  ]);

  strictEqual(inline.code, 0);
  deepStrictEqual(inline.made, [{dataDir: '-x'}]);
});

test('POLARLN_DATA_DIR comes from the env argument, after the flag', async () => {
  const env = {...docker, POLARLN_DATA_DIR: '/env'};

  const fromEnv = await run(['list-networks'], {env});

  strictEqual(fromEnv.code, 0);
  deepStrictEqual(fromEnv.made, [{dataDir: '/env'}]);

  const fromFlag = await run(['list-networks', '--data-dir', '/flag'], {env});

  strictEqual(fromFlag.code, 0);
  deepStrictEqual(fromFlag.made, [{dataDir: '/flag'}]);
});

test('A Docker backend that does not load gives a rejection line', async () => {
  const {code, stderr, stdout} = await run(['list-networks'], {
    env: docker,
    make: () => {
      throw new Error('Cannot find package');
    },
  });

  strictEqual(code, 1);
  strictEqual(stdout, '');
  deepStrictEqual(JSON.parse(stderr), [
    503,
    'FailedToLoadDockerBackend',
    {err: {message: 'Cannot find package'}},
  ]);
});

const usageTests = [
  {
    argv: ['list-networks', '--backend', 'dokcer'],
    description: 'An unknown backend is a usage error',
    error: [
      400,
      'ExpectedAllowedValueForFlag',
      {allowed: ['bridge', 'docker'], flag: '--backend', value: 'dokcer'},
    ],
  },
  {
    argv: ['--help'],
    description: 'A bad POLARLN_BACKEND is a usage error, also for help',
    env: {POLARLN_BACKEND: 'Docker'},
    error: [
      400,
      'ExpectedAllowedValueForEnv',
      {allowed: ['bridge', 'docker'], env: 'POLARLN_BACKEND', value: 'Docker'},
    ],
  },
  {
    argv: ['list-networks', '--backend', 'docker', '--url', 'http://h:1'],
    description: 'The docker backend does not take --url',
    error: [
      400,
      'UnexpectedFlagForBackend',
      {backend: 'docker', flag: '--url', from: '--backend'},
    ],
  },
  {
    argv: ['list-networks', '--data-dir', '/tmp/x'],
    description: 'The bridge backend does not take --data-dir',
    error: [
      400,
      'UnexpectedFlagForBackend',
      {backend: 'bridge', flag: '--data-dir', from: 'default'},
    ],
  },
  {
    argv: ['list-networks', '--data-dir', '--backend', 'docker'],
    description: 'A global flag with no value does not take the next flag',
    error: [400, 'InvalidFlags', {flag: '--data-dir', value: '--backend'}],
  },
  {
    argv: ['list-networks', '--url', '--backend', 'bridge'],
    description: 'A --url flag with no value is a usage error',
    error: [400, 'InvalidFlags', {flag: '--url', value: '--backend'}],
  },
  {
    argv: ['nope', '--backend', 'docker'],
    description: 'An unknown docker command is a usage error',
    error: [400, 'UnknownCommand', {command: 'nope'}],
  },
  {
    argv: ['get-node-info', '--network-id', '4'],
    description: 'A docker command checks the required flags',
    env: docker,
    error: [400, 'MissingRequiredFlags', {flags: ['--node-name']}],
  },
];

usageTests.forEach(({argv, description, env, error}) => {
  test(description, async () => {
    const {code, made, requests, stderr} = await run(argv, {env});

    strictEqual(code, 2);
    deepStrictEqual(JSON.parse(stderr), error);
    deepStrictEqual(requests, []);
    deepStrictEqual(made, []);
  });
});

test('--version does not check the backend', async () => {
  const {code, stdout} = await run(['--version'], {
    env: {POLARLN_BACKEND: 'nope'},
  });

  strictEqual(code, 0);
  strictEqual(stdout, '1.2.3\n');
});

test('Docker help needs no bridge and no Docker', async () => {
  const {code, made, requests, stdout} = await run([], {env: docker});

  strictEqual(code, 0);
  deepStrictEqual(requests, []);
  deepStrictEqual(made, []);

  const lines = stdout.split('\n');

  const commands = lines.slice(lines.indexOf('Commands:') + 1);
  const supported = commands.slice(0, commands.indexOf(''));

  strictEqual(supported.length, 31);
  strictEqual(supported.at(-1)?.startsWith('  get-node-credentials '), true);
  strictEqual(stdout.includes('without the Polar app. Docker must run.'), true);

  const header =
    'Commands that the docker backend does not support yet (error 501):';

  strictEqual(lines.includes(header), true);
  strictEqual(stdout.includes('\n  mint-tap-asset '), true);

  for (const argv of [
    ['--help', '--backend', 'docker'],
    ['help', '--backend', 'docker'],
  ]) {
    strictEqual((await run(argv)).stdout, stdout);
  }
});

test('Docker command help shows a note for an unsupported command', async () => {
  const note =
    'The docker backend does not support this command yet (error 501).';

  const supported = await run(['help', 'open-channel', '--backend', 'docker']);

  strictEqual(supported.code, 0);
  strictEqual(supported.stdout.includes('--network-id <number>'), true);
  strictEqual(supported.stdout.includes(note), false);

  for (const argv of [
    ['mint-tap-asset', '--help', '--backend', 'docker'],
    ['help', '--backend', 'docker', 'mint-tap-asset'],
  ]) {
    const {code, made, stdout} = await run(argv);

    strictEqual(code, 0);
    strictEqual(stdout.includes(`\n${note}\n`), true);
    deepStrictEqual(made, []);
  }
});

test('A tool failure on Docker gives exit code 1', async () => {
  const {code, stderr, stdout} = await run(
    ['get-node-info', '--network-id', '9', '--node-name', 'alice'],
    {
      env: docker,
      respond: () => {
        throw [404, 'PolarNetworkNotFound', {err: notFound}];
      },
    },
  );

  strictEqual(code, 1);
  strictEqual(stdout, '');
  deepStrictEqual(JSON.parse(stderr), [
    404,
    'PolarNetworkNotFound',
    {err: notFound},
  ]);
});

test('get-node-credentials uses the docker backend', async () => {
  const {code, executed, requests, stderr} = await run(
    ['get-node-credentials', '--network-id', '4', '--node-name', 'alice'],
    {env: docker, respond: () => ({networks: []})},
  );

  strictEqual(code, 1);
  deepStrictEqual(requests, []);
  deepStrictEqual(executed, [{args: {}, tool: 'list_networks'}]);

  deepStrictEqual(JSON.parse(stderr), [
    404,
    'PolarNetworkNotFound',
    {networkId: 4},
  ]);
});

test('A bridge-only command gives 501 on Docker', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'polarln-cli-'));

  try {
    const {code, requests, stderr} = await run(
      [
        'mint-tap-asset',
        '--network-id',
        '1',
        '--node-name',
        'alice',
        '--asset-type',
        'normal',
        '--name',
        'x',
        '--amount',
        '1',
        '--backend',
        'docker',
        '--data-dir',
        dataDir,
      ],
      {realDocker: true},
    );

    strictEqual(code, 1);
    deepStrictEqual(requests, []);

    deepStrictEqual(JSON.parse(stderr), [
      501,
      'PolarToolNotSupported',
      {
        err: 'Unknown tool: mint_tap_asset (polarDocker does not support it yet)',
        tool: 'mint_tap_asset',
      },
    ]);
  } finally {
    await rm(dataDir, {force: true, recursive: true});
  }
});
