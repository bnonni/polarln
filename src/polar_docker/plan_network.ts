// Ported from jamaljsr/polar (MIT): src/store/models/mcp/network/createNetwork.ts.

import type {NodeImplementation} from '../typescript/index.js';
import compareVersions from './compare_versions.js';
import type {DockerImplementation} from './docker_configs.js';
import {repoState} from './docker_configs.js';

/** Nodes to Create (a missing count is 1, a missing version is the latest) */
export type NodeRequest = {
  count?: number;
  implementation: NodeImplementation;
  version?: string;
};

/** One Node to Add After the Base Nodes */
export type NodePlan = {implementation: DockerImplementation; version: string};

export type NetworkPlan = {
  /** Nodes to Add After the Base Nodes, bitcoind Nodes First */
  additional: NodePlan[];
  /** Number of bitcoind Nodes at the bitcoind Version */
  bitcoindNodes: number;
  /** bitcoind Version of the Base bitcoind Nodes */
  bitcoindVersion: string;
  /** Number of LND Nodes at the Latest LND Version */
  lndNodes: number;
};

const additionPriority: DockerImplementation[] = ['bitcoind', 'LND'];
const supported: DockerImplementation[] = ['bitcoind', 'LND'];

const defaultRequests: NodeRequest[] = [
  {count: 2, implementation: 'LND'},
  {count: 1, implementation: 'bitcoind'},
];

const isSupported = (n: unknown): n is DockerImplementation =>
  supported.includes(n as DockerImplementation);

const toCount = ({count, implementation}: NodeRequest) => {
  if (count === undefined) {
    return 1;
  }

  if (!Number.isInteger(count) || count <= 0) {
    throw new Error(
      `Invalid count "${count}" for ${implementation}. ` +
        'Provide a positive integer value.',
    );
  }

  return count;
};

// Expand the requests into one entry for each node
const normalize = (requests: NodeRequest[]): NodePlan[] => {
  return requests.flatMap(request => {
    const {implementation} = request;

    if (!implementation) {
      throw new Error('Each node entry must include an implementation.');
    }

    if (!isSupported(implementation)) {
      throw new Error(
        `Unsupported implementation "${implementation}". ` +
          `Supported implementations: ${supported.join(', ')}.`,
      );
    }

    const image = repoState[implementation];
    const count = toCount(request);
    const version = request.version?.trim();

    if (!!version && !image.versions.includes(version)) {
      throw new Error(
        `Version "${version}" is not supported for ${implementation}. ` +
          `Supported versions: ${image.versions.join(', ')}.`,
      );
    }

    return Array.from({length: count}, () => {
      return {implementation, version: version || image.latest};
    });
  });
};

/** Plan the nodes of a new network

  The base nodes use the latest versions. The other nodes come after them.

  {
    [nodes]: [<Node Request Object>]
  }

  @throws
  <Error>

  @returns
  <Network Plan Object>
*/
export default ({nodes}: {nodes?: NodeRequest[]}): NetworkPlan => {
  const requests =
    nodes === undefined ? defaultRequests : nodes.filter(Boolean);

  const normalized = normalize(requests);

  const additional: NodePlan[] = [];
  const latestLnd = repoState.LND.latest;
  const lndCompatibility = repoState.LND.compatibility || {};
  let bitcoindNodes = 0;
  let lndNodes = 0;

  normalized
    .filter(n => n.implementation === 'LND')
    .forEach(n =>
      n.version === latestLnd ? (lndNodes += 1) : additional.push(n),
    );

  // Use the bitcoind version that the latest LND supports
  const bitcoindVersion =
    (lndNodes > 0 && lndCompatibility[latestLnd]) || repoState.bitcoind.latest;

  normalized
    .filter(n => n.implementation === 'bitcoind')
    .forEach(n => {
      return n.version === bitcoindVersion
        ? (bitcoindNodes += 1)
        : additional.push(n);
    });

  // Add the dependencies before the nodes that use them
  additional.sort((a, b) => {
    return (
      additionPriority.indexOf(a.implementation) -
      additionPriority.indexOf(b.implementation)
    );
  });

  const versionsOf = (implementation: DockerImplementation) =>
    additional
      .filter(n => n.implementation === implementation)
      .map(n => n.version);

  const bitcoindVersions = [
    ...(bitcoindNodes > 0 ? [bitcoindVersion] : []),
    ...versionsOf('bitcoind'),
  ];

  const lndVersions = [
    ...(lndNodes > 0 ? [latestLnd] : []),
    ...versionsOf('LND'),
  ];

  if (!!lndVersions.length && !bitcoindVersions.length) {
    throw new Error(
      'Lightning nodes require at least one bitcoind backend. ' +
        'Add a bitcoind entry to the nodes list.',
    );
  }

  lndVersions.forEach(version => {
    const requiredBitcoind = lndCompatibility[version];

    if (!requiredBitcoind) {
      return;
    }

    if (bitcoindVersions.some(v => compareVersions(v, requiredBitcoind) <= 0)) {
      return;
    }

    throw new Error(
      `LND version ${version} requires a bitcoind node at version ` +
        `${requiredBitcoind} or lower. Add a compatible bitcoind node.`,
    );
  });

  return {additional, bitcoindNodes, bitcoindVersion, lndNodes};
};
