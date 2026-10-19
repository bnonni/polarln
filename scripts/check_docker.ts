// Test the polarDocker backend on Docker. Docker must run.
// Run: pnpm check-docker. Exit code 1 means that a check failed.
import {execFile} from 'node:child_process';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {promisify} from 'node:util';

import {authenticatedLndGrpc} from '../src/lnd_grpc/index.js';
import type {AuthenticatedLnd} from '../src/lnd_grpc/index.js';
import {waitFor} from '../src/polar_docker/wait_for.js';
import {
  addNode,
  createNetwork,
  deleteNetwork,
  getBitcoinWalletInfo,
  getBlockchainInfo,
  getNewBitcoinAddress,
  getNodeCredentials,
  listNetworks,
  mineBlocks,
  polarDocker,
  removeNode,
  renameNode,
  restartNode,
  sendBitcoin,
  setAutoMineMode,
  setLightningBackend,
  startNetwork,
  startNode,
  stopNetwork,
  stopNode,
} from '../src/index.js';
import type {Network} from '../src/index.js';

const cycles = 2;
const run = promisify(execFile);

const runDocker = async (args: string[]) => (await run('docker', args)).stdout;

const dataDir = await mkdtemp(join(tmpdir(), 'polarln-live-'));
const {polar} = polarDocker({dataDir});

const log = (message: string) =>
  console.error(`[${(performance.now() / 1000).toFixed(1)}s] ${message}`);

const check = (ok: boolean, what: string) => {
  if (!ok) {
    throw new Error(`check failed: ${what}`);
  }
};

const statuses = (network: Network) =>
  [...network.nodes.bitcoin, ...network.nodes.lightning]
    .map(n => `${n.name}:${n.status}`)
    .join(' ');

const withAlice = async <T>(use: (lnd: AuthenticatedLnd) => Promise<T>) => {
  const creds = await getNodeCredentials({
    networkId: networkId!,
    nodeName: 'alice',
    polar,
  });

  const {close, lnd} = authenticatedLndGrpc(creds.lnd!);

  try {
    return await use(lnd);
  } finally {
    close();
  }
};

const pubkeyOf = async (networkId: number, nodeName: string) => {
  const creds = await getNodeCredentials({networkId, nodeName, polar});

  const {close, lnd} = authenticatedLndGrpc(creds.lnd!);

  try {
    return (await lnd.lightning.getInfo()).identityPubkey as string;
  } finally {
    close();
  }
};

let networkId: number | undefined;

try {
  const created = await createNetwork({
    name: 'live test',
    nodes: [
      {count: 2, implementation: 'bitcoind'},
      {count: 3, implementation: 'LND'},
    ],
    polar,
  });

  networkId = created.network.id;
  log(`created network ${networkId} in ${dataDir}`);

  let pubkey: string | undefined;

  for (let i = 1; i <= cycles; i += 1) {
    const {network} = await startNetwork({networkId, polar});

    log(`start ${i}: ${statuses(network)}`);
    check(!statuses(network).match(/:(?!Started)/), 'all nodes started');

    const key = await pubkeyOf(networkId, 'alice');

    check(!pubkey || key === pubkey, 'alice keeps her key after a restart');
    pubkey = key;

    const stopped = await stopNetwork({networkId, polar});

    log(`stop ${i}: ${stopped.network.status}`);
    check(stopped.network.status === 'Stopped', 'network stopped');
  }

  await startNetwork({networkId, polar});

  const current = async () =>
    (await listNetworks({polar})).networks.find(n => n.id === networkId)!;

  const stoppedNode = await stopNode({networkId, nodeName: 'alice', polar});

  log(`stop_node alice: ${stoppedNode.nodeStatus}`);
  check(stoppedNode.nodeStatus === 'Stopped', 'alice stopped');

  const startedNode = await startNode({networkId, nodeName: 'alice', polar});

  log(`start_node alice: ${startedNode.nodeStatus}`);
  check(startedNode.nodeStatus === 'Started', 'alice started');
  check((await pubkeyOf(networkId, 'alice')) === pubkey, 'alice is online');

  const restarted = await restartNode({networkId, nodeName: 'bob', polar});

  log(`restart_node bob: ${restarted.nodeStatus}`);
  check(restarted.nodeStatus === 'Started', 'bob restarted');

  const addedBtc = await addNode({
    implementation: 'bitcoind',
    networkId,
    polar,
  });

  log(`add_node ${addedBtc.node.name}: ${addedBtc.node.status}`);
  check(addedBtc.node.status === 'Started', 'new bitcoind node started');

  const addedLnd = await addNode({implementation: 'LND', networkId, polar});
  const lndName = addedLnd.node.name;

  log(`add_node ${lndName}: ${addedLnd.node.status}`);
  check(addedLnd.node.status === 'Started', 'new LND node started');

  await setLightningBackend({
    bitcoinNodeName: addedBtc.node.name,
    lightningNodeName: lndName,
    networkId,
    polar,
  });

  const moved = (await current()).nodes.lightning.find(n => n.name === lndName);

  log(`set_lightning_backend ${lndName}: ${moved?.status}`);
  check(moved?.backendName === addedBtc.node.name, 'new backend is saved');
  check(moved?.status === 'Started', 'LND node with new backend started');
  await pubkeyOf(networkId, lndName);

  await removeNode({networkId, nodeName: lndName, polar});
  log(`remove_node ${lndName}: ${statuses(await current())}`);

  await removeNode({networkId, nodeName: addedBtc.node.name, polar});
  log(`remove_node ${addedBtc.node.name}: ${statuses(await current())}`);
  check(!statuses(await current()).match(/:(?!Started)/), 'all nodes started');

  await renameNode({networkId, newName: 'zed', oldName: 'carol', polar});
  log(`rename_node carol zed: ${statuses(await current())}`);
  check(!statuses(await current()).match(/:(?!Started)/), 'all nodes started');
  await pubkeyOf(networkId, 'zed');

  const containers = await runDocker(['ps', '-a', '--format', '{{.Names}}']);
  const names = containers
    .split('\n')
    .filter(n => n.startsWith(`polarln-n${networkId}-`));

  log(`containers: ${names.sort().join(' ')}`);
  check(names.length === 5, 'no containers of removed or renamed nodes');

  const chain = await getBlockchainInfo({networkId, polar});

  await mineBlocks({blocks: 3, networkId, nodeName: 'backend2', polar});

  const after = await getBlockchainInfo({networkId, polar});

  log(
    `mine_blocks 3 on backend2: backend1 height ${chain.blocks} to ${after.blocks}`,
  );
  check(after.blocks === chain.blocks + 3, 'backend1 got the mined blocks');

  const {address} = await getNewBitcoinAddress({
    networkId,
    nodeName: 'alice',
    polar,
  });

  const sent = await sendBitcoin({
    amount: 0.5,
    autoMine: true,
    fromNode: 'backend1',
    networkId,
    polar,
    toAddress: address,
  });

  const {walletInfo} = await getBitcoinWalletInfo({networkId, polar});

  log(
    `send_bitcoin 0.5 to alice: ${sent.txid}, backend1 ${walletInfo.balance}`,
  );
  check(walletInfo.balance > 0, 'backend1 has a balance');

  const aliceBalance = await withAlice(async lnd => {
    return await waitFor({
      check: async () => {
        const {confirmedBalance} = await lnd.lightning.walletBalance();

        if (confirmedBalance !== '50000000') {
          throw new Error(`alice balance is ${confirmedBalance}`);
        }

        return confirmedBalance as string;
      },
      timeout: 30_000,
    });
  });

  log(`alice confirmed balance: ${aliceBalance}`);

  const mode = await setAutoMineMode({mode: 30, networkId, polar});

  check((await current()).autoMineMode === 30, `${mode.modeName} is saved`);

  await stopNetwork({networkId, polar});

  const left = await runDocker(['ps', '-a', '--format', '{{.Names}}']);

  check(
    !left.includes(`polarln-n${networkId}-`),
    'no containers after the stop',
  );
} finally {
  if (networkId !== undefined) {
    await deleteNetwork({networkId, polar});
    log(`deleted network ${networkId}`);
  }

  const {networks} = await listNetworks({polar});

  await rm(dataDir, {force: true, recursive: true});

  check(!networks.length, 'no networks are left');
}

log('all checks passed');
