// Ported from jamaljsr/polar (MIT): src/store/models/mcp/network/deleteNetwork.ts,
// src/store/models/network.ts (remove).

import {rm} from 'node:fs/promises';

import type {DeleteNetworkArgs} from '../../polar_methods/index.js';
import {stopNetwork} from '../network_actions.js';
import {changeNetworks} from '../network_file.js';
import {networkById} from '../network_file.js';
import type {ToolArgs} from './types.js';
import {validateNetworkId} from './validate.js';

/** Delete a network and all of its data (this cannot be undone)

  The result shows the network as it was before the delete
*/
export default async ({args, dataDir}: ToolArgs<DeleteNetworkArgs>) => {
  validateNetworkId(args.networkId);

  const network = await networkById({dataDir, id: args.networkId});

  const before = structuredClone(network);

  const statuses = [
    network.status,
    ...network.nodes.lightning.map(n => n.status),
    ...network.nodes.bitcoin.map(n => n.status),
  ];

  if (statuses.some(status => status !== 'Stopped')) {
    await stopNetwork({dataDir, network});
  }

  await rm(network.path, {force: true, recursive: true});

  await changeNetworks({
    change: networks => {
      const index = networks.findIndex(n => n.id === network.id);

      if (index !== -1) {
        networks.splice(index, 1);
      }
    },
    dataDir,
  });

  return {
    success: true,
    message: `Network "${network.name}" deleted successfully`,
    network: before,
  };
};
