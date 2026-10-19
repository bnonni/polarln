// Ported from jamaljsr/polar (MIT): src/store/models/mcp/network/addNode.ts,
// src/store/models/network.ts (addNode).

import type {AddNodeArgs} from '../../polar_methods/index.js';
import {addBitcoindNode} from '../create_nodes.js';
import {addLndNode} from '../create_nodes.js';
import {polarImplementations} from '../docker_configs.js';
import {repoState} from '../docker_configs.js';
import {saveComposeFile} from '../network_actions.js';
import {networkById} from '../network_file.js';
import {saveNetwork} from '../network_file.js';
import {startNode} from '../node_actions.js';
import type {ToolArgs} from './types.js';
import {validateDockerImplementation} from './validate.js';
import {validateNetworkId} from './validate.js';
import {validateRequired} from './validate.js';

/** Add a node to a network

  If the network is started, start the node and wait until it is online
*/
export default async ({args, dataDir}: ToolArgs<AddNodeArgs>) => {
  validateNetworkId(args.networkId);
  validateRequired(args.implementation, 'Implementation');

  const requested = args.implementation as string;

  if (!(polarImplementations as string[]).includes(requested)) {
    throw new Error(
      `Unsupported implementation '${requested}'. ` +
        `Supported: ${polarImplementations.join(', ')}`,
    );
  }

  const implementation = validateDockerImplementation(requested);

  const network = await networkById({
    dataDir,
    id: args.networkId,
    message: `Network with ID ${args.networkId} not found`,
  });

  const {latest, versions} = repoState[implementation];

  if (!!args.version && !versions.includes(args.version)) {
    throw new Error(
      `Version '${args.version}' is not supported for ${implementation}. ` +
        `Supported versions: ${versions.join(', ')}`,
    );
  }

  const version = args.version || latest;

  const node =
    implementation === 'bitcoind'
      ? addBitcoindNode({network, version})
      : addLndNode({network, version});

  await saveNetwork({dataDir, network});
  await saveComposeFile({network});

  if (network.status === 'Started') {
    await startNode({dataDir, network, node});
  }

  const name = implementation === 'bitcoind' ? 'Bitcoin Core' : implementation;

  return {
    success: true,
    node,
    message:
      `${name} node "${node.name}" added to network ` +
      `"${network.name}" successfully`,
  };
};
