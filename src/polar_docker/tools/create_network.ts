// Ported from jamaljsr/polar (MIT): src/store/models/mcp/network/createNetwork.ts,
// src/store/models/network.ts (addNetwork).

import {existsSync} from 'node:fs';
import {join} from 'node:path';

import type {CreateNetworkArgs} from '../../polar_methods/index.js';
import type {Network} from '../../typescript/index.js';
import {polarImplementations} from '../docker_configs.js';
import {saveComposeFile} from '../network_actions.js';
import {changeNetworks} from '../network_file.js';
import newNetwork from '../new_network.js';
import planNetwork from '../plan_network.js';
import type {ToolArgs} from './types.js';
import {validateDockerImplementation} from './validate.js';
import {validateRequired} from './validate.js';

/** Create a stopped network with nodes */
export default async ({args, folder}: ToolArgs<CreateNetworkArgs>) => {
  validateRequired(args.name, 'Network name');

  if (args.nodes !== undefined && !Array.isArray(args.nodes)) {
    throw new Error('The nodes must be an array');
  }

  // A Polar node type that polarDocker does not run gives 501, as in add_node
  (args.nodes || []).forEach(node => {
    const implementation = node?.implementation as string;

    if ((polarImplementations as string[]).includes(implementation)) {
      validateDockerImplementation(implementation);
    }
  });

  const plan = planNetwork({nodes: args.nodes});
  const name = args.name as string;

  let network: Network | undefined;

  await changeNetworks({
    change: networks => {
      let id = Math.max(0, ...networks.map(n => n.id)) + 1;

      // Do not use a directory that a different program made
      while (existsSync(join(folder.dataDir, 'networks', `${id}`))) {
        id += 1;
      }

      network = newNetwork({
        dataDir: folder.dataDir,
        description: args.description || '',
        id,
        name,
        plan,
      });

      networks.push(network);
    },
    folder,
  });

  await saveComposeFile({folder, network: network as Network});

  return {
    success: true,
    network,
    message: `Network "${name}" created successfully`,
  };
};
