// Ported from jamaljsr/polar (MIT): src/store/models/mcp/helpers.ts (findNode).

import type {BitcoinNode} from '../../typescript/index.js';
import type {LightningNode} from '../../typescript/index.js';
import type {Network} from '../../typescript/index.js';
import type {PolarNode} from '../../typescript/index.js';

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
