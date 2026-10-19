// Ported from jamaljsr/polar (MIT): src/utils/network.ts (createNetwork).

import {join} from 'node:path';

import type {Network} from '../typescript/index.js';
import {addBitcoindNode} from './create_nodes.js';
import {addLndNode} from './create_nodes.js';
import {repoState} from './docker_configs.js';
import type {NetworkPlan} from './plan_network.js';

type Args = {
  /** Data Directory Path */
  dataDir: string;
  description: string;
  id: number;
  name: string;
  plan: NetworkPlan;
};

/** Get a new stopped network with the planned nodes

  {
    dataDir: <Data Directory Path String>
    description: <Network Description String>
    id: <Network Id Number>
    name: <Network Name String>
    plan: <Network Plan Object>
  }

  @throws
  <Error>

  @returns
  <Network Object>
*/
export default ({dataDir, description, id, name, plan}: Args): Network => {
  const network: Network = {
    id,
    name,
    description,
    status: 'Stopped',
    path: join(dataDir, 'networks', `${id}`),
    nodes: {bitcoin: [], lightning: [], tap: []},
    autoMineMode: 0,
    manualMineCount: 6,
  };

  for (let i = 0; i < plan.bitcoindNodes; i += 1) {
    addBitcoindNode({network, version: plan.bitcoindVersion});
  }

  for (let i = 0; i < plan.lndNodes; i += 1) {
    addLndNode({network, version: repoState.LND.latest});
  }

  plan.additional.forEach(({implementation, version}) => {
    return implementation === 'bitcoind'
      ? addBitcoindNode({network, version})
      : addLndNode({network, version});
  });

  return network;
};
