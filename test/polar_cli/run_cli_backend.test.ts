import {deepStrictEqual} from 'node:assert/strict';
import {strictEqual} from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';

import type {PolarProcessScan} from '../../src/polar_app/find_polar_process.js';
import {runCli} from '../../src/polar_cli/index.js';
import type {RunCliArgs} from '../../src/polar_cli/index.js';
import bundledTools from '../../src/polar_cli/bundled_tools.js';
import {fakeDocker} from '../fixtures/fake_docker.js';
import type {FakeExecute} from '../fixtures/fake_docker.js';
import {fakePolar} from '../fixtures/fake_polar.js';
import type {FakeRequest} from '../fixtures/fake_polar.js';
import {aggregateMixed} from '../fixtures/fetch_errors.js';
import {aggregateRefused} from '../fixtures/fetch_errors.js';
import {bunRefused} from '../fixtures/fetch_errors.js';
import {nodeNotFound} from '../fixtures/fetch_errors.js';
import {nodeRefused} from '../fixtures/fetch_errors.js';

const allowed = ['auto', 'bridge', 'docker'];
const defaultUrl = 'http://localhost:37373';
const docker = {POLARLN_BACKEND: 'docker'};
const notFound = "Network with the id '9' was not found.";

const appRunsWithoutBridgeHint =
  'The Polar app runs, but its bridge does not answer at the url. Set ' +
  'POLAR_MCP_PORT, or use --url, with the bridge port of the app. To use ' +
  'Docker, quit the app.';

// The fake bridge answers with the bundled tools and a result for each call
const bridgeAnswers = ({method}: FakeRequest) => {
  return method === 'GET'
    ? {body: {tools: bundledTools}}
    : {body: {networks: []}};
};

// Get the help line that names the backend
const backendLine = (stdout: string) => {
  return stdout.split('\n').find(line => line.startsWith('Backend: '));
};

// Run the command line with a temporary home, a fake Docker backend, and a
// bridge that fails with an error that is not a refused connect
const run = async (
  argv: string[],
  args: {
    bridge?: Parameters<typeof fakePolar>[0];
    env?: {[name: string]: string};
    fetch?: typeof fetch;
    make?: RunCliArgs['polarDocker'];
    realDocker?: boolean;
    respond?: (call: FakeExecute) => unknown;
    scan?: PolarProcessScan;
  } = {},
) => {
  const home = await mkdtemp(join(tmpdir(), 'polarln-cli-home-'));
  const {polar, requests} = fakePolar(
    args.bridge || {error: new Error('NoBridge')},
  );
  const {executed, made, make} = fakeDocker({respond: args.respond});
  const appChecks: string[] = [];
  const scans: string[] = [];
  const stderr: string[] = [];
  const stdout: string[] = [];

  try {
    const code = await runCli({
      argv,
      checkApp: async () => {
        appChecks.push('check');

        throw new Error('ExpectedNoPolarAppCheck');
      },
      env: args.env || {},
      fetch: args.fetch || polar.fetch,
      findProcess: async () => {
        scans.push('scan');

        return (
          args.scan || {err: new Error('ExpectedNoScan'), result: 'unknown'}
        );
      },
      home,
      polarDocker: !!args.realDocker ? undefined : args.make || make,
      stderr: text => stderr.push(text),
      stdout: text => stdout.push(text),
      version: '1.2.3',
    });

    return {
      appChecks,
      code,
      executed,
      home,
      made,
      requests,
      scans,
      stderr: stderr.join(''),
      stdout: stdout.join(''),
    };
  } finally {
    await rm(home, {force: true, recursive: true});
  }
};

test('The docker backend runs a tool without the bridge', async () => {
  const {code, executed, home, made, requests, scans, stderr, stdout} =
    await run([
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
  deepStrictEqual(scans, []);
  deepStrictEqual(made, [{dataDir: join(home, '.polar'), home}]);

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
  const {code, home, made} = await run([
    'list-networks',
    '--backend',
    'docker',
    '--data-dir',
    '/tmp/x',
  ]);

  strictEqual(code, 0);
  deepStrictEqual(made, [{dataDir: '/tmp/x', home}]);

  const inline = await run([
    'list-networks',
    '--backend=docker',
    '--data-dir=-x',
  ]);

  strictEqual(inline.code, 0);

  deepStrictEqual(
    inline.made,
    [{dataDir: join(process.cwd(), '-x'), home: inline.home}],
    'A relative path starts at the working directory',
  );
});

test('POLARLN_DATA_DIR comes from the env argument, after the flag', async () => {
  const env = {...docker, POLARLN_DATA_DIR: '/env'};

  const fromEnv = await run(['list-networks'], {env});

  strictEqual(fromEnv.code, 0);
  deepStrictEqual(fromEnv.made, [{dataDir: '/env', home: fromEnv.home}]);

  const fromFlag = await run(['list-networks', '--data-dir', '/flag'], {env});

  strictEqual(fromFlag.code, 0);
  deepStrictEqual(fromFlag.made, [{dataDir: '/flag', home: fromFlag.home}]);
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
      {allowed, flag: '--backend', value: 'dokcer'},
    ],
  },
  {
    argv: ['--help'],
    description: 'A bad POLARLN_BACKEND is a usage error, also for help',
    env: {POLARLN_BACKEND: 'Docker'},
    error: [
      400,
      'ExpectedAllowedValueForEnv',
      {allowed, env: 'POLARLN_BACKEND', value: 'Docker'},
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
    argv: ['list-networks', '--backend', 'bridge', '--data-dir', '/tmp/x'],
    description: 'The bridge backend does not take --data-dir',
    error: [
      400,
      'UnexpectedFlagForBackend',
      {backend: 'bridge', flag: '--data-dir', from: '--backend'},
    ],
  },
  {
    argv: ['list-networks', '--data-dir', '/tmp/x', '--url', 'http://h:1'],
    description: 'Under auto, --url and --data-dir together are a usage error',
    error: [
      400,
      'UnexpectedFlagForBackend',
      {backend: 'bridge', flag: '--data-dir', from: '--url'},
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
    const {code, made, requests, scans, stderr} = await run(argv, {env});

    strictEqual(code, 2);
    deepStrictEqual(JSON.parse(stderr), error);
    deepStrictEqual(requests, []);
    deepStrictEqual(scans, []);
    deepStrictEqual(made, []);
  });
});

test('--version does not check the backend', async () => {
  const {code, requests, scans, stdout} = await run(['--version'], {
    env: {POLARLN_BACKEND: 'nope'},
  });

  strictEqual(code, 0);
  strictEqual(stdout, '1.2.3\n');
  deepStrictEqual(requests, []);
  deepStrictEqual(scans, []);
});

test('--version under auto sends no request', async () => {
  const {code, requests, scans, stdout} = await run(['--version'], {
    bridge: {error: bunRefused()},
  });

  strictEqual(code, 0);
  strictEqual(stdout, '1.2.3\n');
  deepStrictEqual(requests, [], 'No bridge request');
  deepStrictEqual(scans, [], 'No process scan');
});

test('Docker help needs no bridge and no Docker', async () => {
  const {code, home, made, requests, stdout} = await run([], {env: docker});

  strictEqual(code, 0);
  deepStrictEqual(requests, []);
  deepStrictEqual(made, []);

  strictEqual(
    backendLine(stdout),
    'Backend: docker (POLARLN_BACKEND). ' +
      `Data folder: ${join(home, '.polar')} (the Polar home).`,
  );

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

  // The other help commands differ only in the backend line
  const withoutBackend = (text: string) => {
    return text.replace(/^Backend: .*$/m, '');
  };

  for (const argv of [
    ['--help', '--backend', 'docker'],
    ['help', '--backend', 'docker'],
  ]) {
    const help = await run(argv);

    strictEqual(
      backendLine(help.stdout),
      'Backend: docker (--backend). ' +
        `Data folder: ${join(help.home, '.polar')} (the Polar home).`,
    );

    strictEqual(withoutBackend(help.stdout), withoutBackend(stdout));
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
    const {appChecks, code, requests, stderr} = await run(
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
    deepStrictEqual(appChecks, [], 'A temporary folder has no app check');

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

test('Under auto, a bridge answer selects the bridge', async () => {
  const help = await run([], {bridge: {respond: bridgeAnswers}});

  strictEqual(help.code, 0);

  strictEqual(
    backendLine(help.stdout),
    `Backend: bridge (auto: the Polar app answers at ${defaultUrl}).`,
  );

  strictEqual(help.stdout.includes('error 501'), false);
  deepStrictEqual(help.scans, []);
  deepStrictEqual(help.made, []);

  deepStrictEqual(help.requests, [
    {body: undefined, method: 'GET', url: `${defaultUrl}/api/mcp/tools`},
  ]);

  const list = await run(['list-networks'], {bridge: {respond: bridgeAnswers}});

  strictEqual(list.code, 0);
  strictEqual(list.stdout, '{\n  "networks": []\n}\n');
  deepStrictEqual(list.made, [], 'The Docker backend is not made');

  deepStrictEqual(
    list.requests.map(({method, url}) => [method, url]),
    [
      ['GET', `${defaultUrl}/api/mcp/tools`],
      ['POST', `${defaultUrl}/api/mcp/execute`],
    ],
  );
});

test('Under auto, a refused connect and no Polar process select docker', async () => {
  const errors = [bunRefused(), nodeRefused(), aggregateRefused()];

  // An unknown scan does not show that the app is off
  const scans: [PolarProcessScan, string][] = [
    [{result: 'none'}, `no Polar app at ${defaultUrl}`],
    [
      {err: new Error('PidNamespace'), result: 'unknown'},
      `the Polar bridge does not answer at ${defaultUrl}`,
    ],
  ];

  for (const error of errors) {
    for (const [scan, cause] of scans) {
      const help = await run(['--help'], {bridge: {error}, scan});

      strictEqual(help.code, 0, `Got help for ${scan.result}`);
      deepStrictEqual(help.scans, ['scan'], 'The scan ran one time');
      deepStrictEqual(help.made, [], 'The help needs no Docker backend');

      strictEqual(
        backendLine(help.stdout),
        `Backend: docker (auto: ${cause}). ` +
          `Data folder: ${join(help.home, '.polar')} (the Polar home).`,
      );

      strictEqual(help.stdout.includes('(error 501):'), true);

      const list = await run(['list-networks'], {bridge: {error}, scan});

      strictEqual(list.code, 0);
      deepStrictEqual(list.executed, [{args: {}, tool: 'list_networks'}]);

      deepStrictEqual(
        list.made,
        [{dataDir: join(list.home, '.polar'), home: list.home}],
        'Docker runs on the Polar home',
      );
    }
  }
});

test('Under auto, a refused connect and a Polar process give 409', async () => {
  for (const argv of [['list-networks'], ['--help']]) {
    const {code, executed, made, stderr, stdout} = await run(argv, {
      bridge: {error: nodeRefused()},
      scan: {pid: 4242, result: 'found'},
    });

    strictEqual(code, 1);
    strictEqual(stdout, '');
    deepStrictEqual(made, []);
    deepStrictEqual(executed, []);

    deepStrictEqual(JSON.parse(stderr), [
      409,
      'PolarAppRunsWithoutBridge',
      {hint: appRunsWithoutBridgeHint, pid: 4242, url: defaultUrl},
    ]);
  }
});

test('Under auto, other bridge failures do not select docker', async () => {
  const signals: unknown[] = [];

  // A fetch that gives the error of a timeout signal at once
  const timesOut = async (_url: string | URL | Request, init?: RequestInit) => {
    signals.push(init?.signal);

    throw new DOMException('The operation timed out.', 'TimeoutError');
  };

  const failures: {
    bridge?: Parameters<typeof fakePolar>[0];
    code: string;
    fetch?: typeof fetch;
  }[] = [
    {code: 'FailedToConnectToPolarBridge', fetch: timesOut},
    {
      bridge: {
        body: {error: 'Failed to get tool definitions - timeout'},
        status: 500,
      },
      code: 'PolarToolTimedOut',
    },
    {
      bridge: {error: new Error('fetch failed', {cause: new Error('x')})},
      code: 'FailedToConnectToPolarBridge',
    },
    {bridge: {error: aggregateMixed()}, code: 'FailedToConnectToPolarBridge'},
    {bridge: {error: nodeNotFound()}, code: 'FailedToConnectToPolarBridge'},
    {
      bridge: {body: 'Not Found', status: 404},
      code: 'UnexpectedPolarBridgeResponse',
    },
  ];

  for (const failure of failures) {
    const {code, made, scans, stderr} = await run(['list-networks'], {
      bridge: failure.bridge,
      fetch: failure.fetch,
      scan: {result: 'none'},
    });

    strictEqual(code, 1, `Got exit 1 for ${failure.code}`);
    strictEqual(JSON.parse(stderr)[1], failure.code);
    deepStrictEqual(scans, [], 'No process scan');
    deepStrictEqual(made, [], 'No Docker backend');
  }

  strictEqual(signals.length, 1);
  strictEqual(
    signals[0] instanceof AbortSignal,
    true,
    'The request has a signal',
  );
});

test('A bridge answer without a list of tools gives one error line', async () => {
  const error = [
    503,
    'UnexpectedPolarBridgeResponse',
    {err: 'ExpectedArrayOfPolarTools', url: defaultUrl},
  ];

  const bodies = [
    {},
    'null',
    {tools: {}},
    {tools: [null]},
    {tools: [{name: 'list_networks'}]},
  ];

  // Under auto and with the bridge backend
  const envs: {[name: string]: string}[] = [{}, {POLARLN_BACKEND: 'bridge'}];

  for (const body of bodies) {
    for (const env of envs) {
      const {code, made, scans, stderr, stdout} = await run(['--help'], {
        bridge: {body},
        env,
      });

      const text = `${JSON.stringify(body)} ${JSON.stringify(env)}`;

      strictEqual(code, 1, `Got exit 1 for ${text}`);
      strictEqual(stdout, '');
      strictEqual(stderr.split('\n').length, 2, 'Got one line');
      deepStrictEqual(JSON.parse(stderr), error);
      deepStrictEqual(scans, [], 'No process scan');
      deepStrictEqual(made, [], 'No Docker backend');
    }
  }
});

test('The bridge URL comes from POLAR_MCP_PORT of the env argument', async () => {
  const env = {POLAR_MCP_PORT: '4567'};
  const url = 'http://localhost:4567';

  const help = await run([], {
    bridge: {error: bunRefused()},
    env,
    scan: {result: 'none'},
  });

  strictEqual(help.requests[0]?.url, `${url}/api/mcp/tools`);

  strictEqual(
    backendLine(help.stdout),
    `Backend: docker (auto: no Polar app at ${url}). ` +
      `Data folder: ${join(help.home, '.polar')} (the Polar home).`,
  );

  const bridge = await run([], {
    bridge: {respond: bridgeAnswers},
    env: {...env, POLARLN_BACKEND: 'bridge'},
  });

  strictEqual(
    backendLine(bridge.stdout),
    `Backend: bridge (POLARLN_BACKEND). Bridge URL: ${url}.`,
  );
});

test('Under auto, --url selects the bridge with no fallback', async () => {
  const {code, made, requests, scans, stderr} = await run(
    ['list-networks', '--url', 'http://127.0.0.1:9/'],
    {bridge: {error: bunRefused()}, scan: {result: 'none'}},
  );

  strictEqual(code, 1);
  strictEqual(JSON.parse(stderr)[1], 'FailedToConnectToPolarBridge');
  strictEqual(requests[0]?.url, 'http://127.0.0.1:9/api/mcp/tools');
  deepStrictEqual(scans, []);
  deepStrictEqual(made, []);

  const help = await run(['--help', '--url', 'http://h:1'], {
    bridge: {respond: bridgeAnswers},
  });

  strictEqual(
    backendLine(help.stdout),
    'Backend: bridge (--url). Bridge URL: http://h:1.',
  );
});

test('Under auto, --data-dir selects docker with no bridge request', async () => {
  const list = await run(['list-networks', '--data-dir', '/tmp/x'], {
    bridge: {respond: bridgeAnswers},
  });

  strictEqual(list.code, 0);
  deepStrictEqual(list.requests, []);
  deepStrictEqual(list.scans, []);
  deepStrictEqual(list.made, [{dataDir: '/tmp/x', home: list.home}]);

  const help = await run(['--help', '--data-dir', '/tmp/x']);

  strictEqual(
    backendLine(help.stdout),
    'Backend: docker (--data-dir). Data folder: /tmp/x.',
  );
});

test('Under auto, an empty --data-dir or --url is the same as no flag', async () => {
  const toBridge = [
    ['GET', `${defaultUrl}/api/mcp/tools`],
    ['POST', `${defaultUrl}/api/mcp/execute`],
  ];

  for (const argv of [
    ['list-networks', '--data-dir='],
    ['list-networks', '--data-dir', ''],
    ['list-networks', '--url='],
  ]) {
    const {code, made, requests, stderr} = await run(argv, {
      bridge: {respond: bridgeAnswers},
    });

    strictEqual(stderr, '', `No error for ${argv.join(' ')}`);
    strictEqual(code, 0);
    deepStrictEqual(made, [], 'The bridge answers, so it runs');

    deepStrictEqual(
      requests.map(({method, url}) => [method, url]),
      toBridge,
      'The probe goes to the default URL',
    );
  }

  const list = await run(['list-networks', '--data-dir='], {
    bridge: {error: bunRefused()},
    scan: {result: 'none'},
  });

  strictEqual(list.code, 0);
  deepStrictEqual(list.scans, ['scan']);

  deepStrictEqual(
    list.made,
    [{dataDir: join(list.home, '.polar'), home: list.home}],
    'With no Polar app, docker runs in the Polar home',
  );

  const help = await run(['--help', '--data-dir'], {
    bridge: {respond: bridgeAnswers},
  });

  strictEqual(
    backendLine(help.stdout),
    `Backend: bridge (auto: the Polar app answers at ${defaultUrl}).`,
    'A flag with no value does not select docker',
  );
});

test('Under auto, POLARLN_DATA_DIR does not select docker', async () => {
  const env = {POLARLN_DATA_DIR: '/env'};

  const bridge = await run(['list-networks'], {
    bridge: {respond: bridgeAnswers},
    env,
  });

  strictEqual(bridge.code, 0);
  deepStrictEqual(bridge.made, [], 'The bridge answers, so it runs');

  const help = await run([], {
    bridge: {error: bunRefused()},
    env,
    scan: {result: 'none'},
  });

  strictEqual(
    backendLine(help.stdout),
    `Backend: docker (auto: no Polar app at ${defaultUrl}). ` +
      'Data folder: /env.',
  );

  const list = await run(['list-networks'], {
    bridge: {error: bunRefused()},
    env,
    scan: {result: 'none'},
  });

  deepStrictEqual(list.made, [{dataDir: '/env', home: list.home}]);
});
