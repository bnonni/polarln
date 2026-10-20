// Ported from jamaljsr/polar (MIT): src/store/models/network.ts (toggleNode),
// src/lib/docker/dockerService.ts (startNode, stopNode, removeNode).

import type {Network} from '../typescript/index.js';
import type {PolarNode} from '../typescript/index.js';
import type {DataFolder} from './data_folder.js';
import monitorStartup from './monitor_startup.js';
import {prepareStart} from './network_actions.js';
import {saveNetwork} from './network_file.js';
import runCompose from './run_compose.js';
import setStatus from './set_status.js';

type Args = {
  /** Data Folder */
  folder: DataFolder;
  network: Network;
  /** Node of the Network */
  node: PolarNode;
};

const asError = (err: unknown) =>
  err instanceof Error ? err : new Error(String(err));

/** Start the container of one node and wait for the node

  The method saves each status change in the networks file. The network
  status does not change.

  {
    folder: <Data Folder Object>
    network: <Network Object>
    node: <Node of the Network Object>
  }

  @throws
  <Error>

  @returns via Promise
*/
export const startNode = async ({folder, network, node}: Args) => {
  const save = () => saveNetwork({folder, network});

  setStatus({network, only: node.name, status: 'Starting'});

  await save();

  try {
    await prepareStart({folder, network, nodes: [node]});

    // A container in an error state does not start again without a stop
    await runCompose({args: ['stop', node.name], folder, network});
    await runCompose({args: ['up', '-d', node.name], folder, network});

    await monitorStartup({network, nodes: [node]});
  } catch (err) {
    setStatus({error: asError(err), network, only: node.name, status: 'Error'});

    await save();

    throw err;
  }

  await save();
};

/** Stop the container of one node

  The method saves each status change in the networks file. The network
  status does not change.

  {
    folder: <Data Folder Object>
    network: <Network Object>
    node: <Node of the Network Object>
  }

  @throws
  <Error>

  @returns via Promise
*/
export const stopNode = async ({folder, network, node}: Args) => {
  const save = () => saveNetwork({folder, network});

  setStatus({network, only: node.name, status: 'Stopping'});

  await save();

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
  <Error>

  @returns via Promise
*/
export const removeContainer = async ({folder, network, node}: Args) => {
  await runCompose({args: ['stop', node.name], folder, network});
  await runCompose({args: ['rm', '-f', node.name], folder, network});
};
