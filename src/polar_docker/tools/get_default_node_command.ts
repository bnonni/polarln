// Ported from jamaljsr/polar (MIT): src/store/models/mcp/network/getDefaultNodeCommand.ts.

import type {GetDefaultNodeCommandArgs} from '../../polar_methods/index.js';
import {dockerConfigs} from '../docker_configs.js';
import {repoState} from '../docker_configs.js';
import type {ToolArgs} from './types.js';
import {validateDockerImplementation} from './validate.js';
import {validateRequired} from './validate.js';

/** Get the default Docker command of a node implementation

  The bitcoind and LND commands are the same for all versions
*/
export default async ({args}: ToolArgs<GetDefaultNodeCommandArgs>) => {
  validateRequired(args.implementation, 'Implementation');

  const implementation = validateDockerImplementation(
    args.implementation as string,
  );

  const version = args.version || repoState[implementation].latest;

  return {
    success: true,
    implementation,
    version,
    command: dockerConfigs[implementation].command,
    message: `Retrieved default command for ${implementation} v${version}`,
  };
};
