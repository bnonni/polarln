// Ported from jamaljsr/polar (MIT): src/utils/network.ts, src/utils/config.ts.

import {join} from 'node:path';

import type {BitcoinNode} from '../typescript/index.js';
import type {LndNode} from '../typescript/index.js';
import type {Network} from '../typescript/index.js';
import compareVersions from './compare_versions.js';
import {basePorts} from './docker_configs.js';
import {dockerConfigs} from './docker_configs.js';
import type {DockerImplementation} from './docker_configs.js';
import {repoState} from './docker_configs.js';
import {lightningName} from './node_names.js';

const docker = () => ({command: '', image: ''});
const nextId = (nodes: {id: number}[]) =>
  nodes.length ? Math.max(...nodes.map(n => n.id)) + 1 : 0;

/** Get the host path of the data directory of a node */
export const nodePath = (
  network: Network,
  implementation: DockerImplementation,
  name: string,
) =>
  join(
    network.path,
    'volumes',
    dockerConfigs[implementation].volumeDirName,
    name,
  );

/** Get the host paths of the TLS cert and the macaroons of an LND node */
export const lndPaths = (network: Network, name: string) => {
  const lndPath = nodePath(network, 'LND', name);
  const macaroonPath = (macaroon: string) =>
    join(
      lndPath,
      'data',
      'chain',
      'bitcoin',
      'regtest',
      `${macaroon}.macaroon`,
    );

  return {
    tlsCert: join(lndPath, 'tls.cert'),
    adminMacaroon: macaroonPath('admin'),
    invoiceMacaroon: macaroonPath('invoice'),
    readonlyMacaroon: macaroonPath('readonly'),
  };
};

/** Add a bitcoind node to a network

  The new node and the last bitcoind node are peers

  {
    network: <Network Object>
    version: <bitcoind Version String>
  }

  @returns
  <bitcoind Node Object>
*/
export const addBitcoindNode = ({
  network,
  version,
}: {
  network: Network;
  version: string;
}) => {
  const {bitcoin} = network.nodes;
  const id = nextId(bitcoin);
  const name = `backend${id + 1}`;

  const node: BitcoinNode = {
    id,
    networkId: network.id,
    name,
    type: 'bitcoin',
    implementation: 'bitcoind',
    version,
    peers: [],
    status: 'Stopped',
    ports: {
      rpc: basePorts.bitcoind.rest + id,
      p2p: basePorts.bitcoind.p2p + id,
      zmqBlock: basePorts.bitcoind.zmqBlock + id,
      zmqTx: basePorts.bitcoind.zmqTx + id,
    },
    docker: docker(),
  };

  // Peer up with the previous node on both sides
  const prev = bitcoin.at(-1);

  if (!!prev) {
    node.peers.push(prev.name);
    prev.peers.push(node.name);
  }

  bitcoin.push(node);

  return node;
};

/** Add an LND node to a network

  The LND nodes use the compatible bitcoind nodes in turn as the backend

  {
    network: <Network Object>
    version: <LND Version String>
  }

  @throws
  <Error>

  @returns
  <LND Node Object>
*/
export const addLndNode = ({
  network,
  version,
}: {
  network: Network;
  version: string;
}) => {
  const {bitcoin, lightning} = network.nodes;
  const id = nextId(lightning);
  const name = lightningName(id);
  const requiredVersion = repoState.LND.compatibility?.[version];

  // Without a compatibility entry, all bitcoind versions are compatible
  const backends = bitcoin.filter(n => {
    return !requiredVersion || compareVersions(n.version, requiredVersion) <= 0;
  });

  if (!backends.length) {
    throw new Error(
      `This network does not contain a Bitcoin Core v${requiredVersion} ` +
        `(or lower) node which is required for LND v${version}`,
    );
  }

  const node: LndNode = {
    id,
    networkId: network.id,
    name,
    type: 'lightning',
    implementation: 'LND',
    version,
    status: 'Stopped',
    backendName: backends[id % backends.length].name,
    paths: lndPaths(network, name),
    ports: {
      rest: basePorts.LND.rest + id,
      grpc: basePorts.LND.grpc + id,
      p2p: basePorts.LND.p2p + id,
    },
    docker: docker(),
  };

  lightning.push(node);

  return node;
};
