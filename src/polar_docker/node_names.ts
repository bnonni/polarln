// Ported from jamaljsr/polar (MIT): src/utils/names.ts, src/utils/network.ts.

import type {ContainerPrefix} from './data_folder.js';

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

/** Get the Docker container name of a node

  {
    name: <Node Name String>
    networkId: <Network Id Number>
  }
  <Container Prefix String>

  @returns
  <Container Name String>
*/
export const containerName = (
  node: {name: string; networkId: number},
  prefix: ContainerPrefix,
) => `${prefix}-n${node.networkId}-${node.name}`;

/** Get the Docker compose project name of a network

  The container check and each docker compose command use this name

  {
    id: <Network Id Number>
  }
  <Container Prefix String>

  @returns
  <Compose Project Name String>
*/
export const projectName = (network: {id: number}, prefix: ContainerPrefix) =>
  `${prefix}-network-${network.id}`;

/** Get the name of a lightning node for a node id */
export const lightningName = (id: number) => names[id % names.length];
