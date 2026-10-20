// Ported from jamaljsr/polar (MIT): src/store/models/mcp/network/removeNode.ts,
// src/store/models/network.ts (removeLightningNode, removeBitcoinNode).

import {rm} from 'node:fs/promises';

import type {RemoveNodeArgs} from '../../polar_methods/index.js';
import type {BitcoinNode} from '../../typescript/index.js';
import type {LightningNode} from '../../typescript/index.js';
import type {Network} from '../../typescript/index.js';
import assertNetworkPath from '../assert_network_path.js';
import compareVersions from '../compare_versions.js';
import {nodePath} from '../create_nodes.js';
import type {DataFolder} from '../data_folder.js';
import type {DockerImplementation} from '../docker_configs.js';
import {repoState} from '../docker_configs.js';
import {saveComposeFile} from '../network_actions.js';
import {startNetwork} from '../network_actions.js';
import {stopNetwork} from '../network_actions.js';
import {networkById} from '../network_file.js';
import {saveNetwork} from '../network_file.js';
import {removeContainer} from '../node_actions.js';
import type {ToolArgs} from './types.js';
import {validateNetworkId} from './validate.js';
import {validateRequired} from './validate.js';

type Remove<T> = {folder: DataFolder; network: Network; node: T};

const typeNames = {bitcoin: 'Bitcoin', lightning: 'Lightning'};

// Remove a lightning node, and its container if the container can run
const removeLightningNode = async (args: Remove<LightningNode>) => {
  const {folder, network, node} = args;

  if (network.nodes.tap.some(n => n.lndName === node.name)) {
    throw new Error(
      'Cannot remove a Lightning node that has a Taproot Assets node ' +
        'connected to it.',
    );
  }

  const {activity} = (network.simulation || {}) as {
    activity?: {destination: string; source: string}[];
  };

  if (activity?.some(a => [a.source, a.destination].includes(node.name))) {
    throw new Error(
      `Cannot remove ${node.name} because it is connected to a simulation.`,
    );
  }

  network.nodes.lightning = network.nodes.lightning.filter(n => n !== node);

  // Polar removes the container only if the network is started. If a check
  // of the save refuses, the compose file still has the node, so the tool
  // can run again.
  if (network.status === 'Started' || node.status !== 'Stopped') {
    await removeContainer({folder, network, node});
  }

  // The compose file write runs in the save, so that a refused save keeps
  // the node in the compose file
  await saveNetwork({
    effect: () => saveComposeFile({folder, network}),
    folder,
    network,
  });
};

// Remove a bitcoin node, and restart a started network without the node
const removeBitcoinNode = async (args: Remove<BitcoinNode>) => {
  const {folder, network, node} = args;
  const {bitcoin, lightning} = network.nodes;

  if (bitcoin.length === 1) {
    throw new Error('Cannot remove the only bitcoin node');
  }

  const index = bitcoin.indexOf(node);
  const remaining = bitcoin.filter(n => n !== node);

  // Move the lightning nodes of the node to the first compatible backend
  lightning
    .filter(n => n.backendName === node.name)
    .forEach(n => {
      const {compatibility} =
        repoState[n.implementation as DockerImplementation];
      const required = compatibility?.[n.version];

      const backend = remaining.find(b => {
        return !required || compareVersions(b.version, required) <= 0;
      });

      if (!backend) {
        throw new Error(
          `There are no other compatible backends for ${n.name} to connect ` +
            `to. You must remove the ${n.name} node first`,
        );
      }

      n.backendName = backend.name;
    });

  // Connect the previous and the next node, so that there is one chain
  if (index > 0 && index < bitcoin.length - 1) {
    const [prev, curr, next] = bitcoin.slice(index - 1, index + 2);

    prev.peers = [...prev.peers.filter(p => p !== curr.name), next.name];
    next.peers = [prev.name, ...next.peers.filter(p => p !== curr.name)];
  }

  network.nodes.bitcoin = remaining;

  if (network.status === 'Started') {
    // The compose file on disk still has the node, so the stop removes it
    await stopNetwork({folder, network});
    await startNetwork({folder, network});

    return;
  }

  // A node that runs in a stopped network has a container
  if (node.status !== 'Stopped') {
    await removeContainer({folder, network, node});
  }

  // The compose file write runs in the save, as for a lightning node
  await saveNetwork({
    effect: () => saveComposeFile({folder, network}),
    folder,
    network,
  });
};

/** Remove a node and all of its data from a network

  If a bitcoin node is removed from a started network, the network restarts
*/
export default async ({args, folder}: ToolArgs<RemoveNodeArgs>) => {
  validateNetworkId(args.networkId);
  validateRequired(args.nodeName, 'Node name');

  const network = await networkById({
    folder,
    id: args.networkId,
    message: `Network with ID ${args.networkId} not found`,
  });

  const {bitcoin, lightning, tap} = network.nodes;
  const nodes = [...lightning, ...bitcoin, ...tap];

  const node = nodes.find(n => n.name === args.nodeName);

  if (!node) {
    throw new Error(
      `Node "${args.nodeName}" not found in network "${network.name}". ` +
        `Available nodes: ${nodes.map(n => n.name).join(', ')}`,
    );
  }

  if (node.type === 'tap') {
    throw new Error('polarDocker does not support tapd nodes yet');
  }

  const dir = nodePath(
    network,
    node.implementation as DockerImplementation,
    node.name,
  );

  // A copy of a data folder must not change the folders of the original
  assertNetworkPath({folder, network, paths: [dir]});

  if (node.type === 'bitcoin') {
    await removeBitcoinNode({folder, network, node});
  } else {
    await removeLightningNode({folder, network, node});
  }

  await rm(dir, {force: true, recursive: true});

  return {
    success: true,
    message:
      `${typeNames[node.type]} node "${args.nodeName}" removed from ` +
      `network "${network.name}" successfully`,
  };
};
