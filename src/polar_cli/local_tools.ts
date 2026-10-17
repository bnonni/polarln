import type {PolarTool} from '../polar_bridge/index.js';
import {getNodeCredentials} from '../polar_credentials/index.js';
import type {GetNodeCredentialsArgs} from '../polar_credentials/index.js';
import type {PolarArgs} from '../typescript/index.js';

export type LocalTool = PolarTool & {
  /** Method That Runs the Tool */
  method: (args: PolarArgs<object>) => Promise<unknown>;
};

/** Tools that polarln runs itself, not through the Polar bridge */
const localTools: LocalTool[] = [
  {
    description:
      'Get the gRPC credentials (base64 TLS certificate, base64 macaroon, and socket) of a started LND, litd, or tapd node',
    inputSchema: {
      properties: {
        networkId: {description: 'ID of the network', type: 'number'},
        nodeName: {description: 'Name of the node', type: 'string'},
      },
      required: ['networkId', 'nodeName'],
      type: 'object',
    },
    method: args => getNodeCredentials(args as GetNodeCredentialsArgs),
    name: 'get_node_credentials',
  },
];

export default localTools;
