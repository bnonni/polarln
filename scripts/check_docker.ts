// Test the polarDocker backend on Docker. Docker must run.
// Run: pnpm check-docker. Exit code 1 means that a check failed.
import {execFile} from 'node:child_process';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {promisify} from 'node:util';

import {authenticatedLndGrpc} from '../src/lnd_grpc/index.js';
import {
  addNode,
  createNetwork,
  deleteNetwork,
  getNodeCredentials,
  listNetworks,
  polarDocker,
  removeNode,
  renameNode,
  restartNode,
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
