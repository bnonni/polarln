// Ported from jamaljsr/polar (MIT): src/store/models/network.ts (start, stop),
// src/lib/docker/dockerService.ts (saveComposeFile, start, stop, ensureDirs).

import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';

import type {Network} from '../typescript/index.js';
import type {PolarError} from '../typescript/index.js';
import type {PolarNode} from '../typescript/index.js';
import assertComposeWritable from './assert_compose_writable.js';
import {unsupportedNode} from './assert_compose_writable.js';
import assertNetworkPath from './assert_network_path.js';
import composeFile from './compose_file.js';
import {nodePath} from './create_nodes.js';
import type {DataFolder} from './data_folder.js';
import {volumeSubDirs} from './docker_configs.js';
import monitorStartup from './monitor_startup.js';
import {assertNetworksFileWritable} from './network_file.js';
import {saveNetwork} from './network_file.js';
import openPorts from './open_ports.js';
import type {OpenPorts} from './open_ports.js';
import projectContainers from './project_containers.js';
import {isUp} from './project_containers.js';
import runCompose from './run_compose.js';
import setStatus from './set_status.js';
import writeFileAtomic from './write_file_atomic.js';

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

/** Checked Plan of a Start: Nothing Changed Yet */
export type StartPlan = {
  /** Volume Directories to Make */
  dirs: string[];
  /** New Host Ports for Each Node Name (only for the ports that move) */
  ports?: OpenPorts;
  /** Write a New Compose File */
  writeCompose: boolean;
};

const allNodes = (network: Network): PolarNode[] => {
  const {bitcoin, lightning, tap} = network.nodes;

  return [...bitcoin, ...lightning, ...tap];
};

// Get the first port that must move, which is a port that is in use. The
// new ports of a node kind also have the ports that do not change.
const busyPort = (network: Network, ports: OpenPorts) => {
  const busy = allNodes(network).flatMap(node => {
    const current = node.ports as {[key: string]: number};
    const moved = ports[node.name] || {};

    return Object.keys(moved)
      .filter(key => moved[key] !== current[key])
      .map(key => ({node: node.name, port: current[key]}));
  });

  return busy[0];
};

/** Save the docker compose file of a network

  The network folder must be in the data folder. The new file replaces the
  old file in one step.

  {
    folder: <Data Folder Object>
    network: <Network Object>
  }

  @throws
  [409, 'NetworkPathOutsideDataFolder', {expected, networkId, path}]
  <Error>

  @returns via Promise
*/
export const saveComposeFile = async ({
  folder,
  network,
}: {
  folder: DataFolder;
  network: Network;
}) => {
  assertNetworkPath({folder, network});

  const {file} = composeFile({network, prefix: folder.prefix});

  await mkdir(network.path, {recursive: true});

  await writeFileAtomic({
    path: join(network.path, 'docker-compose.yml'),
    text: file,
  });
};

/** Check the start of nodes, and plan the changes before the start

  The method changes nothing. It checks:
  - A different folder does not use the compose project or the container
    names of the network.
  - Each host port of a node is free, or the container of the node holds
    the port. A port that is in use must move to a free port. A port can
    move only if polarDocker can write a new compose file.
  - The volume directories of the nodes are in the network folder.

  As in Polar, the port check covers each node with no container that runs,
  and a port move writes a new compose file. If polarDocker cannot write a
  new compose file, no port can move. Then the check covers only the nodes
  that start, and a port in use gives 409. polarDocker cannot write a new
  compose file for a network with a tapd, litd, c-lightning, or eclair node,
  or with a compose service that is not a node.

  As in Polar, the compose file of the network stays if it exists and no port
  moves. Thus a start keeps the services of a Polar compose file, for example
  tapd and litd nodes, and the services that a user added.

  {
    folder: <Data Folder Object>
    network: <Network Object>
    nodes: [<Node to Start Object>]
  }

  @throws
  [409, 'ComposeFileHasOtherServices', {networkId, path, services}]
  [409, 'ContainerNameInUse', {container, project, workingDir}]
  [409, 'NetworkPathOutsideDataFolder', {expected, networkId, path}]
  [409, 'PolarPortInUse', {node, port}]
  <Error>

  @returns via Promise
  <Start Plan Object>
*/
export const planStart = async ({
  folder,
  network,
  nodes,
}: {
  folder: DataFolder;
  network: Network;
  nodes: PolarNode[];
}): Promise<StartPlan> => {
  const {states} = await projectContainers({folder, network});

  const starts = new Set(nodes.map(n => n.name));

  // Get the ports that must move. The containers of the network that run
  // hold their own ports. If no port can move, the check covers only the
  // nodes that start. The ports of one node kind move in a chain, so a busy
  // port of a different node can move the free port of a node that starts.
  const portsToMove = (onlyStarts: boolean) => {
    return openPorts({
      isRunning: node => {
        return (
          isUp(states[node.name]) || (onlyStarts && !starts.has(node.name))
        );
      },
      network,
    });
  };

  // A new compose file cannot have the nodes of a kind that polarDocker
  // does not write, so no port can move
  const isFixed = !!unsupportedNode(network);

  let ports = await portsToMove(isFixed);

  if (!!ports && isFixed) {
    throw [
      409,
      'PolarPortInUse',
      busyPort(network, ports),
    ] satisfies PolarError;
  }

  const hasCompose = existsSync(join(network.path, 'docker-compose.yml'));

  if (!!ports || !hasCompose) {
    try {
      await assertComposeWritable({folder, network});
    } catch (err) {
      // A compose file with other services cannot change, so no port can
      // move. Then only a busy port of a node that starts is an error.
      const isOtherServices =
        Array.isArray(err) && err[1] === 'ComposeFileHasOtherServices';

      if (!hasCompose || !isOtherServices || !!(await portsToMove(true))) {
        throw err;
      }

      ports = undefined;
    }
  }

  const writeCompose = !!ports || !hasCompose;

  const dirs = nodes.flatMap(node => {
    const dir = nodePath(network, node.implementation, node.name);
    const subDirs = volumeSubDirs[node.implementation] || [];

    return [dir, ...subDirs.map(name => join(dir, name))];
  });

  assertNetworkPath({folder, network, paths: dirs});

  return {dirs, ports, writeCompose};
};

/** Prepare nodes to start, with a checked start plan

  Move the ports, save the compose file if the plan needs it, and make the
  volume directories, so that the host user owns them. If a port moves, the
  network is saved with its statuses. Polar also checks the ports before the
  statuses change, so a node that runs keeps its ports.

  {
    folder: <Data Folder Object>
    network: <Network Object>
    plan: <Start Plan Object>
    [steps]: <Start and Stop Steps Object> // Default: the real steps
  }

  @throws
  <Error>

  @returns via Promise
*/
export const prepareStart = async ({
  folder,
  network,
  plan,
  steps = actionSteps,
}: {
  folder: DataFolder;
  network: Network;
  plan: StartPlan;
  steps?: ActionSteps;
}) => {
  const {ports} = plan;

  if (!!ports) {
    allNodes(network)
      .filter(n => !!ports[n.name])
      .forEach(n => (n.ports = {...n.ports, ...ports[n.name]}));

    await steps.save({folder, network});
  }

  if (plan.writeCompose) {
    await saveComposeFile({folder, network});
  }

  for (const dir of plan.dirs) {
    await mkdir(dir, {recursive: true});
  }
};

/** Start the containers of a network and wait for the nodes

  The method uses the compose file of the network, as Polar does. It writes
  a new compose file only if the file is not there or a port moves.

  The networks file gets only the final statuses: Started, Stopped, and
  Error. A Starting status on disk makes the Polar app show a status that
  only a delete clears. The method saves a maximum of 3 times:

  1. If a port moves, the network with the moved ports and its old statuses
  2. After the containers start, the network and its nodes with Started
  3. After the wait for the nodes, the node results (Started or Error)

  A failure after the checks saves the Error status. A check that refuses
  changes nothing.

  {
    folder: <Data Folder Object>
    network: <Network Object>
    [steps]: <Start and Stop Steps Object> // Default: the real steps
  }

  @throws
  [409, 'ComposeFileHasOtherServices', {networkId, path, services}]
  [409, 'ContainerNameInUse', {container, project, workingDir}]
  [409, 'NetworkPathOutsideDataFolder', {expected, networkId, path}]
  [409, 'PolarPortInUse', {node, port}]
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

  // A copy of a data folder must not start the containers of the original
  assertNetworkPath({folder, network});

  const plan = await planStart({folder, network, nodes: allNodes(network)});

  try {
    await prepareStart({folder, network, plan, steps});

    // The Starting status stays in memory, as in the Polar app
    setStatus({network, status: 'Starting'});

    await runCompose({args: ['up', '-d'], folder, network});

    // If the wait for the nodes stops, the file still matches the containers
    setStatus({network, status: 'Started'});

    await save();

    await steps.monitor({folder, network});

    await save();
  } catch (err) {
    setStatus({network, status: 'Error'});

    await save();

    throw err;
  }
};

/** Stop and remove the containers of a network

  The node data stays in the volume directories. As in Polar, the command is
  docker compose down, so a container that the compose file does not have
  stays.

  The networks file gets only the final status. After the containers stop,
  the method saves the Stopped status and the automatic mine mode 0. A
  failure after the checks saves the Error status.

  {
    folder: <Data Folder Object>
    network: <Network Object>
    [steps]: <Start and Stop Steps Object> // Default: the real steps
  }

  @throws
  [409, 'ContainerNameInUse', {container, project, workingDir}]
  [409, 'NetworkPathOutsideDataFolder', {expected, networkId, path}]
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

  // A copy of a data folder must not stop the containers of the original
  assertNetworkPath({folder, network});

  await projectContainers({folder, network});

  network.autoMineMode = 0;

  // The Stopping status stays in memory, as in the Polar app
  setStatus({network, status: 'Stopping'});

  try {
    await runCompose({args: ['down'], folder, network});

    setStatus({network, status: 'Stopped'});

    await save();
  } catch (err) {
    setStatus({network, status: 'Error'});

    await save();

    throw err;
  }
};
