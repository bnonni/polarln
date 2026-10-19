// Test the polarDocker backend on Docker. Docker must run.
// Run: pnpm check-docker. Exit code 1 means that a check failed.
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import {authenticatedLndGrpc} from '../src/lnd_grpc/index.js';
import {
  createNetwork,
  deleteNetwork,
  getNodeCredentials,
  listNetworks,
  polarDocker,
  startNetwork,
  stopNetwork,
} from '../src/index.js';
import type {Network} from '../src/index.js';

const cycles = 2;

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

const alicePubkey = async (networkId: number) => {
  const creds = await getNodeCredentials({networkId, nodeName: 'alice', polar});

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

    const key = await alicePubkey(networkId);

    check(!pubkey || key === pubkey, 'alice keeps her key after a restart');
    pubkey = key;

    const stopped = await stopNetwork({networkId, polar});

    log(`stop ${i}: ${stopped.network.status}`);
    check(stopped.network.status === 'Stopped', 'network stopped');
  }
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
