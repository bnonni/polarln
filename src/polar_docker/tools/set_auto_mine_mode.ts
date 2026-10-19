// Ported from jamaljsr/polar (MIT): src/store/models/mcp/bitcoin/setAutoMineMode.ts.

import type {SetAutoMineModeArgs} from '../../polar_methods/index.js';
import type {AutoMineMode} from '../../typescript/index.js';
import {networkById} from '../network_file.js';
import {saveNetwork} from '../network_file.js';
import type {ToolArgs} from './types.js';
import {validateNetworkId} from './validate.js';

const modeNames: {[mode in AutoMineMode]: string} = {
  0: 'Off',
  30: 'Every 30 seconds',
  60: 'Every 1 minute',
  300: 'Every 5 minutes',
  600: 'Every 10 minutes',
};

const validModes = [0, 30, 60, 300, 600];

/** Set the automatic mine interval of a network

  As in Polar, the tool only sets the value: no blocks are mined
*/
export default async ({args, dataDir}: ToolArgs<SetAutoMineModeArgs>) => {
  validateNetworkId(args.networkId);

  if (args.mode == null) {
    throw new Error('Mode is required');
  }

  if (!validModes.includes(args.mode)) {
    throw new Error(
      `Invalid mode: ${args.mode}. Valid modes are: ${validModes.join(', ')}`,
    );
  }

  const network = await networkById({dataDir, id: args.networkId});

  network.autoMineMode = args.mode;

  await saveNetwork({dataDir, network});

  return {
    success: true,
    message: `Set auto-mine mode to "${modeNames[args.mode]}" for network "${network.name}"`,
    networkId: args.networkId,
    mode: args.mode,
    modeName: modeNames[args.mode],
  };
};
