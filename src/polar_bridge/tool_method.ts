import type {PolarArgs} from '../typescript/index.js';
import requestBridge from './request_bridge.js';

const path = '/api/mcp/execute';

/** Make a method that runs one Polar bridge tool

  The method sends all arguments except `polar` to the tool unchanged

  <Tool Name String>

  @returns
  <Method Function>
*/
export default <Args extends object, Result>(tool: string) => {
  return async ({polar, ...args}: PolarArgs<Args>): Promise<Result> => {
    const res = await requestBridge({
      body: {arguments: args, tool},
      path,
      polar,
      tool,
    });

    return res as Result;
  };
};
