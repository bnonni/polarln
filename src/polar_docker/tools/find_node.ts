// Ported from jamaljsr/polar (MIT): src/store/models/mcp/helpers.ts (findNode).

import type {BitcoinNode} from '../../typescript/index.js';
import type {LightningNode} from '../../typescript/index.js';
import type {LndNode} from '../../typescript/index.js';
import type {Network} from '../../typescript/index.js';
import type {PolarNode} from '../../typescript/index.js';
import {lndImplementations} from '../docker_configs.js';

type Args = {
  network: Network;
  /** Node Name (a missing name gives the first node of the type) */
  nodeName?: string;
};

// Get a node by name, or the first node if there is no name
const findOfType = <T extends PolarNode>(
  nodes: T[],
  nodeName: string | undefined,
  typeName: string,
): T => {
  if (!nodeName) {
    if (!nodes.length) {
      throw new Error(`Network has no ${typeName} nodes`);
    }

    return nodes[0];
  }

  const node = nodes.find(n => n.name === nodeName);

  if (!node) {
    throw new Error(`${typeName} node "${nodeName}" not found in network`);
  }

  return node;
};

/** Get a bitcoin node by name, or the first bitcoin node

  {
    network: <Network Object>
    [nodeName]: <Node Name String>
  }

  @throws
  <Error>

  @returns
  <Bitcoin Node Object>
*/
export const findBitcoinNode = ({network, nodeName}: Args): BitcoinNode =>
  findOfType(network.nodes.bitcoin, nodeName, 'Bitcoin');

/** Get a lightning node by name, or the first lightning node

  {
    network: <Network Object>
    [nodeName]: <Node Name String>
  }

  @throws
  <Error>

  @returns
  <Lightning Node Object>
*/
export const findLightningNode = ({network, nodeName}: Args): LightningNode =>
  findOfType(network.nodes.lightning, nodeName, 'Lightning');

/** Get a node of any type by name

  {
    network: <Network Object>
    nodeName: <Node Name String>
  }

  @throws
  <Error>

  @returns
  <Node Object>
*/
export const findNode = ({network, nodeName}: Args): PolarNode => {
  if (!nodeName) {
    throw new Error('Node name is required when type is not specified');
  }

  const {bitcoin, lightning, tap} = network.nodes;

  const node = [...bitcoin, ...lightning, ...tap].find(
    n => n.name === nodeName,
  );

  if (!node) {
    throw new Error(
      `Node "${nodeName}" not found in network "${network.name}"`,
    );
  }

  return node;
};

/** Check if a node has an lnd daemon that the LND tools can use

  An LND node and a litd node have an lnd daemon. Polar uses the LND service
  for both.

  <Node Object>

  @returns
  <Node Has an lnd Daemon Bool>
*/
export const hasLnd = (node: PolarNode): node is LndNode =>
  lndImplementations.includes(node.implementation);

/** Get an LND or litd node by name

  A litd node has an integrated lnd daemon. As in Polar, the LND tools use
  the lnd TLS cert, the lnd admin macaroon, and the grpc port of the litd
  node.

  {
    network: <Network Object>
    nodeName: <Node Name String>
  }

  @throws
  <Error>

  @returns
  <LND Node Object> // A litd node has the same lnd paths and grpc port
*/
export const findLndNode = ({network, nodeName}: Args): LndNode => {
  const node = findLightningNode({network, nodeName});

  if (!hasLnd(node)) {
    throw new Error(
      `polarDocker does not support ${node.implementation} nodes yet`,
    );
  }

  return node;
};
