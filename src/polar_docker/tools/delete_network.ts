// Ported from jamaljsr/polar (MIT): src/store/models/mcp/network/deleteNetwork.ts,
// src/store/models/network.ts (remove).

import {rm} from 'node:fs/promises';

import type {DeleteNetworkArgs} from '../../polar_methods/index.js';
import assertNetworkPath from '../assert_network_path.js';
import {stopNetwork} from '../network_actions.js';
import {changeNetworks} from '../network_file.js';
import {networkById} from '../network_file.js';
import projectContainers from '../project_containers.js';
import {isUp} from '../project_containers.js';
import type {ToolArgs} from './types.js';
import {validateNetworkId} from './validate.js';

/** Delete a network and all of its data (this cannot be undone)

  The network stops first if a status is not Stopped, or if a container of
  the network runs. Polar does not look at the tap node statuses or at the
  containers. The result shows the network as it was before the delete.
*/
export default async ({args, folder}: ToolArgs<DeleteNetworkArgs>) => {
  validateNetworkId(args.networkId);

  const network = await networkById({folder, id: args.networkId});

  // A copy of a data folder must not delete the folder of the original
  assertNetworkPath({folder, network});

  const before = structuredClone(network);

  const {containers} = await projectContainers({folder, network});

  const statuses = [
    network.status,
    ...network.nodes.lightning.map(n => n.status),
    ...network.nodes.bitcoin.map(n => n.status),
    ...network.nodes.tap.map(n => n.status),
  ];

  const runs = containers.some(c => isUp(c.state));

  if (runs || statuses.some(status => status !== 'Stopped')) {
    await stopNetwork({folder, network});
  }

  // The Polar app can start during the stop
  await folder.assertAppOff({stage: 'before-delete'});

  // As in Polar, the folder delete comes before the save. It runs in the
  // save, so that a refused save does not delete the folder.
  await changeNetworks({
    change: networks => {
      const index = networks.findIndex(n => n.id === network.id);

      if (index !== -1) {
        networks.splice(index, 1);
      }
    },
    effect: () => rm(network.path, {force: true, recursive: true}),
    folder,
  });

  return {
    success: true,
    message: `Network "${network.name}" deleted successfully`,
    network: before,
  };
};
