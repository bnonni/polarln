// Ported from jamaljsr/polar (MIT): src/store/models/mcp/network/startNetwork.ts.

import type {StartNetworkArgs} from '../../polar_methods/index.js';
import {startNetwork} from '../network_actions.js';
import {networkById} from '../network_file.js';
import type {ToolArgs} from './types.js';
import {validateNetworkId} from './validate.js';

/** Start all of the nodes in a network */
export default async ({args, folder}: ToolArgs<StartNetworkArgs>) => {
  validateNetworkId(args.networkId);

  const network = await networkById({folder, id: args.networkId});

  await startNetwork({folder, network});

  return {
    success: true,
    message: `Network "${network.name}" started successfully`,
    network,
  };
};
