// Spike: start bitcoind and 2 LND nodes without the Polar app.
// The compose file uses the Polar v4.0.0 templates and Docker images.
// Run: bun scripts/headless_spike.ts up | down
import {execFile} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import {homedir, userInfo} from 'node:os';
import {join} from 'node:path';
import {promisify} from 'node:util';

import {authenticatedLndGrpc} from '../src/lnd_grpc/index.js';

const run = promisify(execFile);

type Payment = {failureReason: string; paymentHash: string; status: string};

// Polar v4.0.0 values: src/utils/constants.ts and src/lib/docker
const bitcoinImage = 'polarlightning/bitcoind:30.0';
const lndImage = 'polarlightning/lnd:0.20.0-beta';
const rpcUser = 'polaruser';
const rpcPass = 'polarpass';
const rpcAuth =
  '5e5e98c21f5c814568f8b55d83b23c1c$$066b03f92df30b11de8e4b1b1cd5b1b4281aa25205bd57df9be82caf97a05526';
const basePorts = {
  bitcoind: {rpc: 18443, p2p: 19444, zmqBlock: 28334, zmqTx: 29335},
  lnd: {rest: 8081, grpc: 10001, p2p: 9735},
};
const blocksTilConfirmed = 6;
const channelSats = 250_000;
const invoiceSats = 10_000;

const networkId = 1;
const dataDir = process.env.POLARLN_DATA_DIR || join(homedir(), '.polarln');
const networkDir = join(dataDir, 'networks', `${networkId}`);
const composePath = join(networkDir, 'docker-compose.yml');
const portsPath = join(networkDir, 'ports.json');
const backend = 'backend1';
const lndNames = ['alice', 'bob'];

type Ports = {
  bitcoind: typeof basePorts.bitcoind;
  lnd: Record<string, typeof basePorts.lnd>;
};

const containerName = (name: string) => `polarln-n${networkId}-${name}`;

const log = (message: string) =>
  console.error(`[${(performance.now() / 1000).toFixed(1)}s] ${message}`);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Retry the check until it returns a value or the time ends
const waitFor = async <T>(
  check: () => Promise<T | undefined>,
  what: string,
  timeoutMs = 120_000,
): Promise<T> => {
  const end = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < end) {
    try {
      const value = await check();

      if (value !== undefined) return value;
    } catch (err) {
      lastError = err;
    }
    await delay(1000);
  }

  throw new Error(`timeout: ${what}`, {cause: lastError});
};

const isPortFree = (port: number) =>
  new Promise<boolean>(resolve => {
    const server = createServer();

    server.once('error', () => resolve(false));
    server.listen(port, '0.0.0.0', () => server.close(() => resolve(true)));
  });

// Find the first free port at or above the base, like Polar getOpenPorts
const freePort = async (base: number, taken: Set<number>) => {
  let port = base;

  while (taken.has(port) || !(await isPortFree(port))) port += 1;
  taken.add(port);

  return port;
};

const allocatePorts = async (): Promise<Ports> => {
  const taken = new Set<number>();
  const b = basePorts.bitcoind;
  const bitcoind = {
    rpc: await freePort(b.rpc, taken),
    p2p: await freePort(b.p2p, taken),
    zmqBlock: await freePort(b.zmqBlock, taken),
    zmqTx: await freePort(b.zmqTx, taken),
  };
  const lnd: Ports['lnd'] = {};

  for (const name of lndNames) {
    const l = basePorts.lnd;

    lnd[name] = {
      rest: await freePort(l.rest, taken),
      grpc: await freePort(l.grpc, taken),
      p2p: await freePort(l.p2p, taken),
    };
  }

  return {bitcoind, lnd};
};

const bitcoindCommand = [
  'bitcoind',
  '-server=1',
  '-regtest=1',
  `-rpcauth=${rpcUser}:${rpcAuth}`,
  '-debug=1',
  '-zmqpubrawblock=tcp://0.0.0.0:28334',
  '-zmqpubrawtx=tcp://0.0.0.0:28335',
  '-zmqpubhashblock=tcp://0.0.0.0:28336',
  '-txindex=1',
  '-dnsseed=0',
  '-rpcbind=0.0.0.0',
  '-rpcallowip=0.0.0.0/0',
  '-rpcport=18443',
  '-rest',
  '-listen=1',
  '-listenonion=0',
  '-fallbackfee=0.0002',
  '-blockfilterindex=1',
  '-peerblockfilters=1',
].join(' ');

const lndCommand = (name: string) =>
  [
    'lnd',
    '--noseedbackup',
    '--debuglevel=debug',
    '--trickledelay=5000',
    `--alias=${name}`,
    `--externalip=${name}`,
    `--tlsextradomain=${name}`,
    `--tlsextradomain=${containerName(name)}`,
    '--tlsextradomain=host.docker.internal',
    '--listen=0.0.0.0:9735',
    '--rpclisten=0.0.0.0:10009',
    '--restlisten=0.0.0.0:8080',
    '--bitcoin.active',
    '--bitcoin.regtest',
    '--bitcoin.node=bitcoind',
    `--bitcoind.rpchost=${containerName(backend)}`,
    `--bitcoind.rpcuser=${rpcUser}`,
    `--bitcoind.rpcpass=${rpcPass}`,
    `--bitcoind.zmqpubrawblock=tcp://${containerName(backend)}:28334`,
    `--bitcoind.zmqpubrawtx=tcp://${containerName(backend)}:28335`,
    '--accept-keysend',
    '--accept-amp',
  ].join(' ');

const environment = {USERID: '${USERID:-1000}', GROUPID: '${GROUPID:-1000}'};

// JSON is valid YAML, so docker compose reads this file without js-yaml
const composeFile = (ports: Ports) => {
  const services: Record<string, unknown> = {
    [backend]: {
      environment,
      stop_grace_period: '5m',
      image: bitcoinImage,
      container_name: containerName(backend),
      hostname: backend,
      command: bitcoindCommand,
      volumes: [`./volumes/bitcoind/${backend}:/home/bitcoin/.bitcoin`],
      expose: ['18443', '18444', '28334', '28335'],
      ports: [
        `${ports.bitcoind.rpc}:18443`,
        `${ports.bitcoind.p2p}:18444`,
        `${ports.bitcoind.zmqBlock}:28334`,
        `${ports.bitcoind.zmqTx}:28335`,
      ],
    },
  };

  for (const name of lndNames) {
    const p = ports.lnd[name];

    services[name] = {
      environment,
      stop_grace_period: '30s',
      image: lndImage,
      container_name: containerName(name),
      hostname: name,
      command: lndCommand(name),
      restart: 'always',
      volumes: [`./volumes/lnd/${name}:/home/lnd/.lnd`],
      expose: ['8080', '10009', '9735'],
      ports: [`${p.rest}:8080`, `${p.grpc}:10009`, `${p.p2p}:9735`],
    };
  }

  return JSON.stringify(
    {name: `polarln-network-${networkId}`, services},
    null,
    2,
  );
};

// Set the user and group IDs so that the containers can write the volumes
const compose = (...args: string[]) => {
  const {uid, gid} = userInfo();

  return run('docker', ['compose', '-f', composePath, ...args], {
    cwd: networkDir,
    env: {...process.env, USERID: `${uid}`, GROUPID: `${gid}`},
  });
};

const bitcoinRpc = async <T>(
  port: number,
  method: string,
  params: unknown[] = [],
): Promise<T> => {
  const res = await fetch(`http://127.0.0.1:${port}/`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${btoa(`${rpcUser}:${rpcPass}`)}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({jsonrpc: '1.0', id: method, method, params}),
  });
  const body = (await res.json()) as {result: T; error?: {message: string}};

  if (body.error) throw new Error(`${method}: ${body.error.message}`);

  return body.result;
};

const lndClient = async (name: string, ports: Ports) => {
  const dir = join(networkDir, 'volumes', 'lnd', name);
  const certPath = join(dir, 'tls.cert');
  const macaroonPath = join(dir, 'data/chain/bitcoin/regtest/admin.macaroon');

  await waitFor(
    async () => (existsSync(certPath) && existsSync(macaroonPath)) || undefined,
    `${name} credentials`,
  );

  return authenticatedLndGrpc({
    socket: `localhost:${ports.lnd[name].grpc}`,
    cert: (await readFile(certPath)).toString('hex'),
    macaroon: (await readFile(macaroonPath)).toString('hex'),
  }).lnd;
};

const up = async () => {
  if (existsSync(composePath)) {
    throw new Error(`network exists: ${networkDir}. Run "down" first.`);
  }

  // Make the volume folders before docker does, so the host user owns them
  await mkdir(join(networkDir, 'volumes', 'bitcoind', backend), {
    recursive: true,
  });
  for (const name of lndNames) {
    await mkdir(join(networkDir, 'volumes', 'lnd', name), {recursive: true});
  }

  const ports = await allocatePorts();

  await writeFile(composePath, composeFile(ports));
  await writeFile(portsPath, JSON.stringify(ports, null, 2));
  log(`compose file: ${composePath}`);

  await compose('up', '-d');
  log('containers started');

  const btc = <T>(method: string, params?: unknown[]) =>
    bitcoinRpc<T>(ports.bitcoind.rpc, method, params);

  await waitFor(() => btc('getblockchaininfo'), 'bitcoind RPC');
  if (!(await btc<string[]>('listwallets')).length) {
    await btc('createwallet', ['']);
  }
  const mine = async (blocks: number) =>
    btc('generatetoaddress', [blocks, await btc<string>('getnewaddress')]);

  await mine(1);
  log('bitcoind online, wallet made, 1 block mined');

  const rpcs = Object.fromEntries(
    await Promise.all(
      lndNames.map(async name => [name, await lndClient(name, ports)] as const),
    ),
  );

  for (const name of lndNames) {
    await waitFor(async () => {
      const {state} = await rpcs[name].state.getState();

      return state === 'SERVER_ACTIVE' || undefined;
    }, `${name} server active`);
  }
  log('LND nodes online');

  const [alice, bob] = [rpcs.alice, rpcs.bob];
  const bobInfo = await bob.lightning.getInfo();
  const [bobPubkey, bobHost] = bobInfo.uris[0].split('@');

  await alice.lightning.connectPeer({addr: {pubkey: bobPubkey, host: bobHost}});
  log(`alice connected to ${bobInfo.uris[0]}`);

  // Fund alice with 2x the channel size, like Polar autoFund
  const {address} = await alice.lightning.newAddress();

  await mine(100);
  await btc('sendtoaddress', [address, (channelSats * 2) / 1e8]);
  await mine(blocksTilConfirmed);
  await waitFor(async () => {
    const {confirmedBalance} = await alice.lightning.walletBalance();

    return Number(confirmedBalance) > 0 || undefined;
  }, 'alice confirmed balance');
  log(`alice funded: ${(channelSats * 2).toLocaleString()} sats`);

  const point = await alice.lightning.openChannelSync({
    nodePubkeyString: bobPubkey,
    localFundingAmount: channelSats,
    satPerVbyte: 1,
  });
  // Same txid read as Polar lndService.openChannel
  const fundingTxid =
    point.fundingTxidStr ||
    Buffer.from(point.fundingTxidBytes as Uint8Array)
      .reverse()
      .toString('hex');
  const channelPoint = `${fundingTxid}:${point.outputIndex}`;

  await delay(500);
  await mine(blocksTilConfirmed);
  // Both nodes must list the channel as active before a payment can use it
  for (const name of lndNames) {
    await waitFor(async () => {
      const {channels} = await rpcs[name].lightning.listChannels({
        activeOnly: true,
      });

      return channels.length > 0 || undefined;
    }, `${name} active channel`);
  }
  log(`channel open: ${channelPoint}`);

  const invoice = await bob.lightning.addInvoice({
    value: invoiceSats,
    memo: 'polarln headless spike',
  });
  const pay = () =>
    new Promise<Payment>((resolve, reject) => {
      const stream = alice.router.sendPaymentV2({
        paymentRequest: invoice.paymentRequest,
        timeoutSeconds: 60,
        feeLimitSat: 100,
      });

      stream.on('data', (p: Payment) => {
        if (p.status === 'SUCCEEDED') resolve(p);
        if (p.status === 'FAILED') reject(new Error(p.failureReason));
      });
      stream.on('error', reject);
    });
  let attempts = 0;
  // The link can need some seconds after the channel_ready exchange
  const payment = await waitFor(
    () => {
      attempts += 1;

      return pay();
    },
    'payment',
    30_000,
  );
  log(`payment ${payment.status}: ${invoiceSats} sats, ${attempts} attempts`);

  // SUCCEEDED comes before the commitment update ends on both nodes
  const bobChannels = await waitFor(async () => {
    const balance = await bob.lightning.channelBalance();

    return Number(balance.localBalance?.sat) >= invoiceSats
      ? balance
      : undefined;
  }, 'bob channel balance');
  const [chain, aliceChannels] = await Promise.all([
    btc<{blocks: number}>('getblockchaininfo'),
    alice.lightning.channelBalance(),
  ]);

  console.log(
    JSON.stringify(
      {
        networkDir,
        ports,
        blocks: chain.blocks,
        channelPoint,
        paymentHash: payment.paymentHash,
        aliceLocalSats: aliceChannels.localBalance?.sat,
        bobLocalSats: bobChannels.localBalance?.sat,
      },
      null,
      2,
    ),
  );
};

const down = async () => {
  if (!existsSync(composePath)) {
    log(`no network at ${networkDir}`);

    return;
  }

  await compose('down');
  log('containers removed');

  await rm(networkDir, {recursive: true, force: true});
  log(`removed ${networkDir}`);
};

const [command] = process.argv.slice(2);

if (command === 'up') {
  await up();
  process.exit(0);
} else if (command === 'down') {
  await down();
} else {
  console.error('usage: bun scripts/headless_spike.ts up | down');
  process.exitCode = 2;
}
