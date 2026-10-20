// Ported from jamaljsr/polar (MIT): src/store/models/network.ts (toggleNode),
// src/lib/docker/dockerService.ts (startNode, stopNode, removeNode).

import type {Network} from '../typescript/index.js';
import type {PolarNode} from '../typescript/index.js';
import assertNetworkPath from './assert_network_path.js';
import type {DataFolder} from './data_folder.js';
import type {ActionSteps} from './network_actions.js';
import {actionSteps} from './network_actions.js';
import {prepareStart} from './network_actions.js';
import {assertNetworksFileWritable} from './network_file.js';
import runCompose from './run_compose.js';
import setStatus from './set_status.js';

type Args = {
  /** Data Folder */
  folder: DataFolder;
  network: Network;
  /** Node of the Network */
  node: PolarNode;
  /** Start and Stop Steps (default: the real steps) */
  steps?: ActionSteps;
};

const asError = (err: unknown) =>
  err instanceof Error ? err : new Error(String(err));

/** Start the container of one node and wait for the node

  The networks file gets only the final statuses, as in a network start. The
  method saves a maximum of 3 times: the moved ports, the Started status
  after the container starts, and the result of the wait. A failure saves the
  Error status. The network status does not change.

  {
    folder: <Data Folder Object>
    network: <Network Object>
    node: <Node of the Network Object>
    [steps]: <Start and Stop Steps Object> // Default: the real steps
  }

  @throws
  [409, 'NetworkPathOutsideDataFolder', {expected, networkId, path}]
  <Error>

  @returns via Promise
*/
export const startNode = async ({
  folder,
  network,
  node,
  steps = actionSteps,
}: Args) => {
  const save = () => steps.save({folder, network});

  // Do not start the container if the save after the start cannot write
  await assertNetworksFileWritable({folder});

  // A copy of a data folder must not start the containers of the original
  assertNetworkPath({folder, network});

  try {
    await prepareStart({folder, network, nodes: [node], steps});

    // The Starting status stays in memory, as in the Polar app
    setStatus({network, only: node.name, status: 'Starting'});

    // A container in an error state does not start again without a stop
    await runCompose({args: ['stop', node.name], folder, network});
    await runCompose({args: ['up', '-d', node.name], folder, network});

    setStatus({network, only: node.name, status: 'Started'});

    await save();

    await steps.monitor({network, nodes: [node]});
  } catch (err) {
    setStatus({error: asError(err), network, only: node.name, status: 'Error'});

    await save();

    throw err;
  }

  await save();
};

/** Stop the container of one node

  The networks file gets only the final status. After the container stops,
  the method saves the Stopped status. A failure saves the Error status. The
  network status does not change.

  {
    folder: <Data Folder Object>
    network: <Network Object>
    node: <Node of the Network Object>
    [steps]: <Start and Stop Steps Object> // Default: the real steps
  }

  @throws
  [409, 'NetworkPathOutsideDataFolder', {expected, networkId, path}]
  <Error>

  @returns via Promise
*/
export const stopNode = async ({
  folder,
  network,
  node,
  steps = actionSteps,
}: Args) => {
  const save = () => steps.save({folder, network});

  // Do not stop the container if the save after the stop cannot write
  await assertNetworksFileWritable({folder});

  // A copy of a data folder must not stop the containers of the original
  assertNetworkPath({folder, network});

  // The Stopping status stays in memory, as in the Polar app
  setStatus({network, only: node.name, status: 'Stopping'});

  try {
    await runCompose({args: ['stop', node.name], folder, network});
  } catch (err) {
    setStatus({error: asError(err), network, only: node.name, status: 'Error'});

    await save();

    throw err;
  }

  setStatus({network, only: node.name, status: 'Stopped'});

  await save();
};

/** Stop and remove the container of one node

  The compose file must still contain the node

  {
    folder: <Data Folder Object>
    network: <Network Object>
    node: <Node Object>
  }

  @throws
  [409, 'NetworkPathOutsideDataFolder', {expected, networkId, path}]
  <Error>

  @returns via Promise
*/
export const removeContainer = async ({folder, network, node}: Args) => {
  assertNetworkPath({folder, network});

  await runCompose({args: ['stop', node.name], folder, network});
  await runCompose({args: ['rm', '-f', node.name], folder, network});
};
