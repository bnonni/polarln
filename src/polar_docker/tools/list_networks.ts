// Ported from jamaljsr/polar (MIT): src/store/models/mcp/network/listNetworks.ts.

import {readNetworks} from '../network_file.js';
import type {ToolArgs} from './types.js';

/** List all networks with their nodes, ports, and file paths */
export default async ({folder}: ToolArgs<object>) => {
  const {networks} = await readNetworks({folder});

  return {networks};
};
