// Ported from jamaljsr/polar (MIT): src/store/models/mcp/network/renameNode.ts,
// src/store/models/network.ts (renameNode), src/utils/network.ts (renameNode),
// src/lib/docker/dockerService.ts (renameNodeDir),
// src/store/models/designer.ts (renameNode).

import {existsSync} from 'node:fs';
import {rename} from 'node:fs/promises';
import {rm} from 'node:fs/promises';

import type {RenameNodeArgs} from '../../polar_methods/index.js';
import type {Network} from '../../typescript/index.js';
import type {PolarNode} from '../../typescript/index.js';
import assertNetworkPath from '../assert_network_path.js';
import {lndPaths} from '../create_nodes.js';
import {nodePath} from '../create_nodes.js';
import type {DockerImplementation} from '../docker_configs.js';
import {saveComposeFile} from '../network_actions.js';
import {startNetwork} from '../network_actions.js';
import {stopNetwork} from '../network_actions.js';
import {changeNetworks} from '../network_file.js';
import {networkById} from '../network_file.js';
import {renameChartNode} from '../polar_chart.js';
import type {ToolArgs} from './types.js';
import {validateNetworkId} from './validate.js';
import {validateRequired} from './validate.js';

const typeNames = {bitcoin: 'Bitcoin', lightning: 'Lightning'};

// Get the TLS files to delete, as lnd makes a new TLS cert for a new host name
const tlsFiles = (node: PolarNode) => {
  if (node.implementation !== 'LND') {
    return [];
  }

  const cert = node.paths.tlsCert;

  return [cert, cert.replace('.cert', '.key')];
};

// Move the data directory of a node to the new name
const renameNodeDir = async (
  network: Network,
  node: PolarNode,
  name: string,
) => {
  const implementation = node.implementation as DockerImplementation;
  const oldPath = nodePath(network, implementation, node.name);

  for (const file of tlsFiles(node)) {
    await rm(file, {force: true});
  }

  if (existsSync(oldPath)) {
    await rename(oldPath, nodePath(network, implementation, name));
  }
};

// Change the node name, and the names that refer to the node
const renameInNetwork = (network: Network, node: PolarNode, name: string) => {
  const {bitcoin, lightning, tap} = network.nodes;

  if (node.type === 'bitcoin') {
    lightning
      .filter(n => n.backendName === node.name)
      .forEach(n => (n.backendName = name));

    bitcoin
      .filter(n => n.peers.includes(node.name))
      .forEach(n => (n.peers = n.peers.map(p => (p === node.name ? name : p))));
  }

  if (node.implementation === 'LND') {
    tap.filter(n => n.lndName === node.name).forEach(n => (n.lndName = name));

    node.paths = lndPaths(network, name);
  }

  node.name = name;
};

/** Rename a node

  If the node runs, the network stops before the rename and starts again after
  the rename. Polar does not wait for the start; this tool waits.
*/
export default async ({args, folder}: ToolArgs<RenameNodeArgs>) => {
  validateNetworkId(args.networkId);
  validateRequired(args.oldName, 'Old node name');
  validateRequired(args.newName, 'New node name');

  const newName = args.newName as string;

  if (!/^[a-zA-Z0-9_-]+$/.test(newName)) {
    throw new Error(
      'New node name must contain only letters, numbers, hyphens, and underscores',
    );
  }

  const network = await networkById({
    folder,
    id: args.networkId,
    message: `Network with ID ${args.networkId} not found`,
  });

  const {bitcoin, lightning, tap} = network.nodes;
  const nodes = [...lightning, ...bitcoin, ...tap];

  const node = nodes.find(n => n.name === args.oldName);

  if (!node) {
    throw new Error(
      `Node "${args.oldName}" not found in network "${network.name}". ` +
        `Available nodes: ${nodes.map(n => n.name).join(', ')}`,
    );
  }

  const existing = nodes.find(n => n.name === newName);

  if (!!existing && existing !== node) {
    throw new Error(
      `Node name "${newName}" is already taken by another node in network ` +
        `"${network.name}"`,
    );
  }

  if (node.type === 'tap') {
    throw new Error('polarDocker does not support tapd nodes yet');
  }

  const implementation = node.implementation as DockerImplementation;

  // A copy of a data folder must not change the folders of the original
  assertNetworkPath({
    folder,
    network,
    paths: [
      nodePath(network, implementation, node.name),
      nodePath(network, implementation, newName),
      ...tlsFiles(node),
    ],
  });

  const oldName = node.name;
  const wasStarted = node.status === 'Started';

  if (wasStarted) {
    await stopNetwork({folder, network});
  }

  // The Polar app can start during the stop
  await folder.assertAppOff({stage: 'before-delete'});

  // The folder move needs the old name and the old TLS paths
  const oldNode = structuredClone(node);

  renameInNetwork(network, node, newName);

  // The folder move, the TLS delete, and the new compose file run in the
  // save, so that a refused save does not change them. As in Polar, the
  // folder move comes before the save.
  await changeNetworks({
    change: (networks, charts) => {
      const index = networks.findIndex(n => n.id === network.id);

      if (index === -1) {
        return;
      }

      networks[index] = network;

      // The chart node keeps its position, as in Polar
      renameChartNode({charts, id: network.id, name: newName, nodeId: oldName});
    },
    effect: async () => {
      await renameNodeDir(network, oldNode, newName);
      await saveComposeFile({folder, network});
    },
    folder,
  });

  if (wasStarted) {
    await startNetwork({folder, network});
  }

  return {
    success: true,
    message:
      `${typeNames[node.type]} node "${args.oldName}" renamed to ` +
      `"${newName}" in network "${network.name}" successfully`,
  };
};
