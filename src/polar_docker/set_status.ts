// Ported from jamaljsr/polar (MIT): src/store/models/network.ts (setStatus).

import type {Network} from '../typescript/index.js';
import type {Status} from '../typescript/index.js';

type Args = {
  /** Change the Network Status and All Node Statuses (default: true) */
  all?: boolean;
  /** Node Error */
  error?: Error;
  network: Network;
  /** Change Only the Status of the Node With This Name */
  only?: string;
  status: Status;
};

/** Set the status of a network, of its nodes, or of one node

  {
    [all]: <Change the Network and All Nodes Bool>
    [error]: <Node Error Object>
    network: <Network Object>
    [only]: <Node Name String>
    status: <Status String>
  }
*/
export default ({all = true, error, network, only, status}: Args) => {
  const {bitcoin, lightning, tap} = network.nodes;

  const nodes = [...bitcoin, ...lightning, ...tap];

  const setNode = (n: (typeof nodes)[number]) => {
    n.status = status;
    n.errorMsg = error?.message;
  };

  if (!!only) {
    return nodes.filter(n => n.name === only).forEach(setNode);
  }

  network.status = status;

  if (all) {
    nodes.forEach(setNode);
  }
};
