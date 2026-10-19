import type {PolarArgs} from '../typescript/index.js';
import type {PolarBackend} from '../typescript/index.js';
import type {PolarDocker} from '../typescript/index.js';
import requestBridge from './request_bridge.js';

const isDocker = (polar: PolarBackend): polar is PolarDocker =>
  typeof (polar as Partial<PolarDocker> | undefined)?.execute === 'function';
const path = '/api/mcp/execute';

/** Make a method that runs one Polar tool

  The method sends all arguments except `polar` to the tool unchanged

  A Docker backend runs the tool. Else the Polar bridge runs the tool.

  <Tool Name String>

  @returns
  <Method Function>
*/
export default <Args extends object, Result>(tool: string) => {
  return async ({polar, ...args}: PolarArgs<Args>): Promise<Result> => {
    if (isDocker(polar)) {
      return (await polar.execute(tool, args)) as Result;
    }

    const res = await requestBridge({
      body: {arguments: args, tool},
      path,
      polar,
      tool,
    });

    return res as Result;
  };
};
