// Ported from jamaljsr/polar (MIT): src/store/models/mcp/network/setLightningBackend.ts,
// src/store/models/network.ts (updateBackendNode).

import type {SetLightningBackendArgs} from '../../polar_methods/index.js';
import {saveComposeFile} from '../network_actions.js';
import {networkById} from '../network_file.js';
import {saveNetwork} from '../network_file.js';
import {startNode} from '../node_actions.js';
import {stopNode} from '../node_actions.js';
import type {ToolArgs} from './types.js';
import {validateNetworkId} from './validate.js';
import {validateRequired} from './validate.js';

/** Set the bitcoin backend node of a lightning node

  If the network is started, the lightning node restarts with the new backend
*/
export default async ({args, folder}: ToolArgs<SetLightningBackendArgs>) => {
  validateNetworkId(args.networkId);
  validateRequired(args.lightningNodeName, 'Lightning node name');
  validateRequired(args.bitcoinNodeName, 'Bitcoin node name');

  const network = await networkById({folder, id: args.networkId});

  const lnName = args.lightningNodeName as string;
  const backendName = args.bitcoinNodeName as string;

  const node = network.nodes.lightning.find(n => n.name === lnName);

  if (!node) {
    throw new Error(`The node '${lnName}' was not found.`);
  }

  const backend = network.nodes.bitcoin.find(n => n.name === backendName);

  if (!backend) {
    throw new Error(`The node '${backendName}' was not found.`);
  }

  if (node.backendName === backendName) {
    throw new Error(
      `The node '${lnName}' is already connected to '${backendName}'`,
    );
  }

  const isStarted = network.status === 'Started';

  if (isStarted) {
    await stopNode({folder, network, node});
  }

  node.backendName = backend.name;

  await saveNetwork({folder, network});
  await saveComposeFile({folder, network});

  // Polar waits for all of the nodes of the network, not only for this node
  if (isStarted) {
    await startNode({folder, network, node});
  }

  return {
    success: true,
    message:
      `Successfully changed backend for Lightning node "${lnName}" to ` +
      `Bitcoin node "${backendName}" in network "${network.name}"`,
    networkId: args.networkId,
    lightningNodeName: lnName,
    bitcoinNodeName: backendName,
  };
};
