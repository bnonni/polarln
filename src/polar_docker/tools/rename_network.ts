// Ported from jamaljsr/polar (MIT): src/store/models/mcp/network/renameNetwork.ts.

import type {RenameNetworkArgs} from '../../polar_methods/index.js';
import {networkById} from '../network_file.js';
import {saveNetwork} from '../network_file.js';
import type {ToolArgs} from './types.js';
import {validateNetworkId} from './validate.js';
import {validateRequired} from './validate.js';

/** Rename a network, and change its description if there is a description */
export default async ({args, folder}: ToolArgs<RenameNetworkArgs>) => {
  validateNetworkId(args.networkId);
  validateRequired(args.name, 'Network name');

  const network = await networkById({folder, id: args.networkId});

  network.name = args.name as string;
  network.description = args.description ?? network.description;

  await saveNetwork({folder, network});

  return {
    success: true,
    message: `Network renamed to "${network.name}" successfully`,
    network,
  };
};
