// Ported from jamaljsr/polar (MIT): src/store/models/mcp/network/stopNetwork.ts.

import type {StopNetworkArgs} from '../../polar_methods/index.js';
import {stopNetwork} from '../network_actions.js';
import {networkById} from '../network_file.js';
import type {ToolArgs} from './types.js';
import {validateNetworkId} from './validate.js';

/** Stop all of the nodes in a network */
export default async ({args, folder}: ToolArgs<StopNetworkArgs>) => {
  validateNetworkId(args.networkId);

  const network = await networkById({folder, id: args.networkId});

  await stopNetwork({folder, network});

  return {
    success: true,
    message: `Network "${network.name}" stopped successfully`,
    network,
  };
};
