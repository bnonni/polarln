import type {Polar} from '../typescript/index.js';
import requestBridge from './request_bridge.js';

export type PolarTool = {
  /** Tool Description */
  description: string;
  /** Tool Arguments JSON Schema */
  inputSchema: {
    properties: {[name: string]: {[key: string]: unknown}};
    required?: string[];
    type: 'object';
  };
  /** Tool Name (for example mine_blocks) */
  name: string;
};

/** List the tools that the Polar bridge supports

  Use this method to check that the Polar app runs

  If the bridge does not send the full answer within the timeout, the method
  rejects with 503 FailedToConnectToPolarBridge.

  {
    polar: <Polar Bridge Object>
    [timeout]: <Maximum Milliseconds Number> // Default: no limit
  }

  @returns via Promise
  {
    tools: [<Polar Tool Object>]
  }
*/
export default async (args: {
  polar: Polar;
  timeout?: number;
}): Promise<{tools: PolarTool[]}> => {
  const res = await requestBridge({
    path: '/api/mcp/tools',
    polar: args.polar,
    timeout: args.timeout,
  });

  return res as {tools: PolarTool[]};
};
