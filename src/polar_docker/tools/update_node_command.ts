// Ported from jamaljsr/polar (MIT): src/store/models/mcp/network/updateNodeCommand.ts,
// src/store/models/network.ts (updateAdvancedOptions).

import type {UpdateNodeCommandArgs} from '../../polar_methods/index.js';
import {saveComposeFile} from '../network_actions.js';
import {networkById} from '../network_file.js';
import {saveNetwork} from '../network_file.js';
import {findNode} from './find_node.js';
import type {ToolArgs} from './types.js';
import {validateNetworkId} from './validate.js';
import {validateRequired} from './validate.js';

/** Set the Docker command of a node (an empty command is the default command)

  The node uses the new command after its next start
*/
export default async ({args, dataDir}: ToolArgs<UpdateNodeCommandArgs>) => {
  validateNetworkId(args.networkId);
  validateRequired(args.nodeName, 'Node name');

  if (args.command === undefined) {
    throw new Error(
      'Command is required (use empty string to reset to default)',
    );
  }

  const network = await networkById({dataDir, id: args.networkId});

  const node = findNode({network, nodeName: args.nodeName});

  node.docker.command = args.command;

  await saveNetwork({dataDir, network});
  await saveComposeFile({network});

  const message = !!args.command
    ? `Successfully updated custom command for node "${args.nodeName}"`
    : `Successfully reset node "${args.nodeName}" to use default command`;

  return {
    success: true,
    message: `${message} in network "${network.name}"`,
    networkId: args.networkId,
    nodeName: args.nodeName,
    command: args.command,
  };
};
