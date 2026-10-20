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
import {saveNetwork} from './network_file.js';
import openPorts from './open_ports.js';
import runCompose from './run_compose.js';
import setStatus from './set_status.js';

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

  Move the ports that a different program uses, save the network and the
  compose file, and make the volume directories, so that the host user owns
  them

  {
    folder: <Data Folder Object>
    network: <Network Object>
    nodes: [<Node to Start Object>]
  }

  @returns via Promise
*/
export const prepareStart = async ({
  folder,
  network,
  nodes,
}: {
  folder: DataFolder;
  network: Network;
  nodes: PolarNode[];
}) => {
  const ports = await openPorts({network});

  allNodes(network)
    .filter(n => !!ports?.[n.name])
    .forEach(n => (n.ports = {...n.ports, ...ports?.[n.name]}));

  await saveNetwork({folder, network});
  await saveComposeFile({folder, network});

  for (const node of nodes) {
    const implementation = node.implementation as DockerImplementation;

    await mkdir(nodePath(network, implementation, node.name), {
      recursive: true,
    });
  }
};

/** Start the containers of a network and wait for the nodes

  The method saves each status change in the networks file

  {
    folder: <Data Folder Object>
    network: <Network Object>
  }

  @throws
  <Error>

  @returns via Promise
*/
export const startNetwork = async ({
  folder,
  network,
}: {
  folder: DataFolder;
  network: Network;
}) => {
  const save = () => saveNetwork({folder, network});

  setStatus({network, status: 'Starting'});

  await save();

  try {
    await prepareStart({folder, network, nodes: allNodes(network)});

    await runCompose({args: ['up', '-d'], folder, network});

    setStatus({all: false, network, status: 'Started'});

    await save();

    await monitorStartup({network});

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

  {
    folder: <Data Folder Object>
    network: <Network Object>
  }

  @throws
  <Error>

  @returns via Promise
*/
export const stopNetwork = async ({
  folder,
  network,
}: {
  folder: DataFolder;
  network: Network;
}) => {
  const save = () => saveNetwork({folder, network});

  network.autoMineMode = 0;

  setStatus({network, status: 'Stopping'});

  await save();

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
