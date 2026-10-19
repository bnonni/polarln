// Ported from jamaljsr/polar (MIT): src/store/models/mcp/lightning/node-info/getNodeInfo.ts.

import type {GetNodeInfoArgs} from '../../polar_methods/index.js';
import {getInfo} from '../lnd_service.js';
import {networkById} from '../network_file.js';
import {findLndNode} from './find_node.js';
import type {ToolArgs} from './types.js';
import {validateNetworkId} from './validate.js';
import {validateRequired} from './validate.js';

/** Get the info of a lightning node */
export default async ({args, dataDir}: ToolArgs<GetNodeInfoArgs>) => {
  validateNetworkId(args.networkId);
  validateRequired(args.nodeName, 'Node name');

  const network = await networkById({dataDir, id: args.networkId});

  const node = findLndNode({network, nodeName: args.nodeName});

  const info = await getInfo(node);

  return {
    success: true,
    message:
      `Retrieved info for node "${args.nodeName}": ` +
      `${info.alias} (${info.pubkey.slice(0, 12)}...)`,
    networkId: args.networkId,
    nodeName: args.nodeName,
    info,
  };
};
