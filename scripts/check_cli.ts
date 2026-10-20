// Test the polarln CLI with the docker backend under Node. Docker must run.
// Run: pnpm check-cli. Exit code 1 means that a check failed.
// Each command runs as a new "node dist/cli.js" process. The check fails if a
// process does not exit within 1 s after its last output.
// Each process gets a temporary HOME, so that no process uses the Polar home,
// and POLAR_MCP_PORT at a closed port. DOCKER_CONFIG keeps the docker
// configuration of the user.
import {execFile} from 'node:child_process';
import {spawn} from 'node:child_process';
import {mkdtemp, rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {homedir} from 'node:os';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

import findPolarProcess from '../src/polar_app/find_polar_process.js';

const cliPath = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
const srcCliPath = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
const hangMs = 180_000;
const maxExitLagMs = 1000;
const run = promisify(execFile);

type Result = {
  code: number | null;
  exitLagMs: number;
  ms: number;
  stderr: string;
  stdout: string;
};

const rows: {command: string; code: number | null; lag: number; ms: number}[] =
  [];

// Get a port with no listener: listen on a free port, then close it
const closedPort = async () => {
  const server = createServer();

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));

  const address = server.address();

  await new Promise(resolve => server.close(resolve));

  if (!address || typeof address === 'string') {
    throw new Error('ExpectedPortOfServer');
  }

  return address.port;
};

const dockerConfig = process.env.DOCKER_CONFIG || join(homedir(), '.docker');

const log = (message: string) =>
  console.error(`[${(performance.now() / 1000).toFixed(1)}s] ${message}`);

const check = (ok: boolean, what: string) => {
  if (!ok) {
    throw new Error(`check failed: ${what}`);
  }
};

// Run one command in a new process and measure the time to exit
const cli = (args: {
  argv: string[];
  command?: string;
  env?: {[name: string]: string};
  runtime?: string[];
}) => {
  const start = performance.now();
  const [program = 'node', ...runtimeArgs] = args.runtime || ['node', cliPath];

  // Do not use the POLARLN variables of the shell, or the real home
  const env = {
    ...process.env,
    DOCKER_CONFIG: dockerConfig,
    HOME: cliHome,
    POLAR_MCP_PORT: bridgePort,
  };

  delete env.POLARLN_BACKEND;
  delete env.POLARLN_DATA_DIR;

  const child = spawn(program, [...runtimeArgs, ...args.argv], {
    env: {...env, ...args.env},
  });

  const name = args.command || args.argv[0] || '';
  const stderr: string[] = [];
  const stdout: string[] = [];

  let lastOutput = start;

  child.stdout.on('data', chunk => {
    lastOutput = performance.now();
    stdout.push(chunk.toString());
  });

  child.stderr.on('data', chunk => {
    lastOutput = performance.now();
    stderr.push(chunk.toString());
  });

  return new Promise<Result>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');

      reject(new Error(`hang: ${name}`));
    }, hangMs);

    child.on('error', err => {
      clearTimeout(timer);

      reject(err);
    });

    child.on('exit', code => {
      clearTimeout(timer);

      const end = performance.now();
      const exitLagMs = Math.max(0, end - lastOutput);

      rows.push({code, command: name, lag: exitLagMs, ms: end - start});

      resolve({
        code,
        exitLagMs,
        ms: end - start,
        stderr: stderr.join(''),
        stdout: stdout.join(''),
      });
    });
  });
};

// Check the exit code and the exit lag of a command
const expectExit = (res: Result, code: number, what: string) => {
  check(res.code === code, `${what} exit code ${code} (stderr: ${res.stderr})`);
  check(res.exitLagMs < maxExitLagMs, `${what} exits within 1 s`);
};

// Run a command that must succeed, and get its JSON result
const ok = async (argv: string[], env: {[name: string]: string}) => {
  const res = await cli({argv, env});

  log(`${argv[0]}: exit ${res.code}, lag ${res.exitLagMs.toFixed(0)} ms`);

  expectExit(res, 0, argv[0] || '');
  check(res.stderr === '', `${argv[0]} writes no error output`);

  return JSON.parse(res.stdout);
};

const leftovers = async () => {
  const {stdout} = await run('docker', [
    'ps',
    '-a',
    '-q',
    '--filter',
    'name=^polarln-n1-',
  ]);

  return stdout.split('\n').filter(Boolean);
};

// A new data directory gets network 1, so its containers are polarln-n1-*
if (!!(await leftovers()).length) {
  console.error('polarln-n1-* containers exist. Remove them, then run again.');

  process.exit(2);
}

const {stdout: nodeVersion} = await run('node', ['--version']);

log(`node ${nodeVersion.trim()}`);

const dataDir = await mkdtemp(join(tmpdir(), 'polarln-cli-'));

// The temporary HOME of each process, and the closed bridge port
const cliHome = await mkdtemp(join(tmpdir(), 'polarln-cli-home-'));
const bridgePort = `${await closedPort()}`;
const docker = {POLARLN_BACKEND: 'docker', POLARLN_DATA_DIR: dataDir};

let networkId: number | undefined;

try {
  // Commands that do not need Docker
  const help = await cli({argv: ['--help', '--backend', 'docker']});

  expectExit(help, 0, 'docker help');
  check(help.stdout.includes('(error 501):'), 'docker help lists 501 tools');

  const tapd = await cli({
    argv: [
      'mint-tap-asset',
      '--backend',
      'docker',
      '--data-dir',
      dataDir,
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
    ],
  });

  expectExit(tapd, 1, 'mint-tap-asset');
  check(
    tapd.stderr.startsWith('[501,"PolarToolNotSupported"'),
    'mint-tap-asset rejects with 501',
  );

  const url = await cli({
    argv: ['list-networks', '--backend', 'docker', '--url', 'http://h:1'],
  });

  expectExit(url, 2, '--url with docker');
  check(url.stderr.includes('UnexpectedFlagForBackend'), '--url usage error');

  // With no flags, auto probes the closed bridge port. With no Polar process,
  // it selects docker on the Polar home of the temporary HOME. A Polar process
  // gives 409, so the case is skipped if the Polar app runs. An unknown scan
  // also selects docker, but the help names only the bridge.
  const polarProcess = await findPolarProcess();

  if (polarProcess.result === 'found') {
    log(`skip the auto checks: Polar process ${polarProcess.pid} runs`);
  } else {
    const autoHelp = await cli({argv: ['--help'], command: 'auto help'});

    const bridgeUrl = `http://localhost:${bridgePort}`;

    const autoCause =
      polarProcess.result === 'unknown'
        ? `the Polar bridge does not answer at ${bridgeUrl}`
        : `no Polar app at ${bridgeUrl}`;

    const autoLine =
      `Backend: docker (auto: ${autoCause}). ` +
      `Data folder: ${join(cliHome, '.polar')} (the Polar home).`;

    expectExit(autoHelp, 0, 'auto help');
    check(autoHelp.stdout.includes(`\n${autoLine}\n`), 'auto selects docker');

    const autoList = await cli({
      argv: ['list-networks'],
      command: 'auto list-networks',
    });

    expectExit(autoList, 0, 'auto list-networks');
    check(
      autoList.stdout === '{\n  "networks": []\n}\n',
      'auto list-networks reads the empty Polar home',
    );
  }

  // A network flow with the environment variables
  const nodes = [
    {count: 1, implementation: 'bitcoind'},
    {count: 2, implementation: 'LND'},
  ];

  const created = await ok(
    ['create-network', '--name', 'cli check', '--nodes', JSON.stringify(nodes)],
    docker,
  );

  networkId = created.network.id as number;

  check(networkId === 1, 'the new network has id 1');

  const id = `${networkId}`;

  const started = await ok(['start-network', '--network-id', id], docker);

  check(started.network.status === 'Started', 'the network is started');

  const creds = await ok(
    ['get-node-credentials', '--network-id', id, '--node-name', 'alice'],
    docker,
  );

  check(!!creds.lnd?.cert && !!creds.lnd?.macaroon, 'alice has credentials');

  const opened = await ok(
    [
      'open-channel',
      '--network-id',
      id,
      '--from-node',
      'alice',
      '--to-node',
      'bob',
      '--sats',
      '250000',
    ],
    docker,
  );

  check(!!opened.channelPoint, 'open-channel gives a channel point');

  const created2 = await ok(
    [
      'create-invoice',
      '--network-id',
      id,
      '--node-name',
      'bob',
      '--amount',
      '1000',
    ],
    docker,
  );

  await ok(
    [
      'pay-invoice',
      '--network-id',
      id,
      '--from-node',
      'alice',
      '--invoice',
      created2.invoice,
    ],
    docker,
  );

  const channels = await ok(
    ['list-channels', '--network-id', id, '--node-name', 'bob'],
    docker,
  );

  check(channels.channels.length === 1, 'bob has 1 channel');

  // The close stream stays open until the close confirms
  await ok(
    [
      'close-channel',
      '--network-id',
      id,
      '--node-name',
      'alice',
      '--channel-point',
      opened.channelPoint,
    ],
    docker,
  );

  await ok(['mine-blocks', '--network-id', id, '--blocks', '1'], docker);

  // The flags without the environment variables
  const listed = await ok(
    ['list-networks', '--backend', 'docker', '--data-dir', dataDir],
    {},
  );

  check(listed.networks.length === 1, 'list-networks shows the network');

  // bun runs the built CLI and the source CLI too
  for (const runtime of [
    ['bun', cliPath],
    ['bun', srcCliPath],
  ]) {
    const res = await cli({
      argv: ['list-networks', '--backend', 'docker', '--data-dir', dataDir],
      command: `bun ${runtime[1] === cliPath ? 'dist' : 'src'} list-networks`,
      runtime,
    });

    expectExit(res, 0, runtime.join(' '));
  }
} finally {
  if (networkId !== undefined) {
    const id = `${networkId}`;

    for (const command of ['stop-network', 'delete-network']) {
      const res = await cli({argv: [command, '--network-id', id], env: docker});

      // Do not throw here: a throw hides the first failure
      if (res.code !== 0 || res.exitLagMs >= maxExitLagMs) {
        log(`check failed: ${command} exit ${res.code}, ${res.stderr}`);

        process.exitCode = 1;
      }
    }
  }

  const containers = await leftovers();

  if (!!containers.length) {
    log(`remove ${containers.length} containers`);

    await run('docker', ['rm', '-f', ...containers]);
  }

  await rm(dataDir, {force: true, recursive: true});
  await rm(cliHome, {force: true, recursive: true});

  console.table(
    rows.map(row => ({
      command: row.command,
      exit: row.code,
      'exit lag (ms)': Math.round(row.lag),
      'time (ms)': Math.round(row.ms),
    })),
  );
}
