// Ported from jamaljsr/polar (MIT): src/utils/names.ts, src/utils/network.ts.

import {containerPrefix} from './docker_configs.js';

const names = [
  'alice',
  'bob',
  'carol',
  'dave',
  'erin',
  'frank',
  'grace',
  'heidi',
  'ivan',
  'judy',
  'kathy',
  'lucy',
  'mike',
  'niaj',
  'oscar',
  'pat',
  'quincy',
  'rupert',
  'sybil',
  'trent',
  'ulyssa',
  'victor',
  'wendy',
  'xavior',
  'yuki',
  'zora',
];

/** Get the Docker container name of a node */
export const containerName = (node: {name: string; networkId: number}) =>
  `${containerPrefix}-n${node.networkId}-${node.name}`;

/** Get the name of a lightning node for a node id */
export const lightningName = (id: number) => names[id % names.length];
