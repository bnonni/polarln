// Ported from jamaljsr/polar (MIT): src/store/models/network.ts (start, stop),
// src/lib/docker/dockerService.ts (saveComposeFile, start, stop, ensureDirs).

import {mkdir} from 'node:fs/promises';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';

import type {Network} from '../typescript/index.js';
import type {PolarNode} from '../typescript/index.js';
import composeFile from './compose_file.js';
import {nodePath} from './create_nodes.js';
import type {DataFolder} from './data_folder.js';
import type {DockerImplementation} from './docker_configs.js';
import monitorStartup from './monitor_startup.js';
import {assertNetworksFileWritable} from './network_file.js';
import {saveNetwork} from './network_file.js';
import openPorts from './open_ports.js';
import runCompose from './run_compose.js';
import setStatus from './set_status.js';

/** Steps of a Start and a Stop That a Test Can Replace */
export type ActionSteps = {
  /** Wait for the Started Nodes and Set Their Statuses */
  monitor: typeof monitorStartup;
  /** Save a Network in the Networks File */
  save: typeof saveNetwork;
};

/** The Real Steps of a Start and a Stop */
export const actionSteps: ActionSteps = {
  monitor: monitorStartup,
  save: saveNetwork,
};

const allNodes = (network: Network): PolarNode[] => {
  const {bitcoin, lightning, tap} = network.nodes;

  return [...bitcoin, ...lightning, ...tap];
};

/** Save the docker compose file of a network

  {
    folder: <Data Folder Object>
    network: <Network Object>
  }

  @returns via Promise
*/
export const saveComposeFile = async ({
  folder,
  network,
}: {
  folder: DataFolder;
  network: Network;
}) => {
  await mkdir(network.path, {recursive: true});

  await writeFile(
    join(network.path, 'docker-compose.yml'),
    composeFile({network, prefix: folder.prefix}).file,
  );
};

/** Prepare nodes to start

  Move the ports that a different program uses, save the compose file, and
  make the volume directories, so that the host user owns them. If a port
  moves, the network is saved with its statuses. Polar also checks the ports
  before the statuses change, so a Started node keeps its ports.

  {
    folder: <Data Folder Object>
    network: <Network Object>
    nodes: [<Node to Start Object>]
    [steps]: <Start and Stop Steps Object> // Default: the real steps
  }

  @throws
  <Error>

  @returns via Promise
*/
export const prepareStart = async ({
  folder,
  network,
  nodes,
  steps = actionSteps,
}: {
  folder: DataFolder;
  network: Network;
  nodes: PolarNode[];
  steps?: ActionSteps;
}) => {
  const ports = await openPorts({network});

  allNodes(network)
    .filter(n => !!ports?.[n.name])
    .forEach(n => (n.ports = {...n.ports, ...ports?.[n.name]}));

  if (!!ports) {
    await steps.save({folder, network});
  }

  await saveComposeFile({folder, network});

  for (const node of nodes) {
    const implementation = node.implementation as DockerImplementation;

    await mkdir(nodePath(network, implementation, node.name), {
      recursive: true,
    });
  }
};

/** Start the containers of a network and wait for the nodes

  The networks file gets only the final statuses: Started, Stopped, and
  Error. A Starting status on disk makes the Polar app show a status that
  only a delete clears. The method saves a maximum of 3 times:

  1. If a port moves, the network with the moved ports and its old statuses
  2. After the containers start, the network and its nodes with Started
  3. After the wait for the nodes, the node results (Started or Error)

  A failure saves the Error status.

  {
    folder: <Data Folder Object>
    network: <Network Object>
    [steps]: <Start and Stop Steps Object> // Default: the real steps
  }

  @throws
  <Error>

  @returns via Promise
*/
export const startNetwork = async ({
  folder,
  network,
  steps = actionSteps,
}: {
  folder: DataFolder;
  network: Network;
  steps?: ActionSteps;
}) => {
  const save = () => steps.save({folder, network});

  // Do not start containers if the save after the start cannot write
  await assertNetworksFileWritable({folder});

  try {
    await prepareStart({folder, network, nodes: allNodes(network), steps});

    // The Starting status stays in memory, as in the Polar app
    setStatus({network, status: 'Starting'});

    await runCompose({args: ['up', '-d'], folder, network});

    // If the wait for the nodes stops, the file still matches the containers
    setStatus({network, status: 'Started'});

    await save();

    await steps.monitor({network});

    await save();
  } catch (err) {
    setStatus({network, status: 'Error'});

    await save();

    throw err;
  }
};

/** Stop and remove the containers of a network

  The node data stays in the volume directories. The containers of removed and
  renamed nodes are removed too.

  The networks file gets only the final status. After the containers stop,
  the method saves the Stopped status and the automatic mine mode 0. A
  failure saves the Error status.

  {
    folder: <Data Folder Object>
    network: <Network Object>
    [steps]: <Start and Stop Steps Object> // Default: the real steps
  }

  @throws
  <Error>

  @returns via Promise
*/
export const stopNetwork = async ({
  folder,
  network,
  steps = actionSteps,
}: {
  folder: DataFolder;
  network: Network;
  steps?: ActionSteps;
}) => {
  const save = () => steps.save({folder, network});

  // Do not stop containers if the save after the stop cannot write
  await assertNetworksFileWritable({folder});

  network.autoMineMode = 0;

  // The Stopping status stays in memory, as in the Polar app
  setStatus({network, status: 'Stopping'});

  try {
    await runCompose({args: ['down', '--remove-orphans'], folder, network});

    setStatus({network, status: 'Stopped'});

    await save();
  } catch (err) {
    setStatus({network, status: 'Error'});

    await save();

    throw err;
  }
};
