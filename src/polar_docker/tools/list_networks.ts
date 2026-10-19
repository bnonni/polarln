// Ported from jamaljsr/polar (MIT): src/store/models/mcp/network/listNetworks.ts.

import {readNetworks} from '../network_file.js';
import type {ToolArgs} from './types.js';

/** List all networks with their nodes, ports, and file paths */
export default async ({dataDir}: ToolArgs<object>) => {
  const {networks} = await readNetworks({dataDir});

  return {networks};
};
