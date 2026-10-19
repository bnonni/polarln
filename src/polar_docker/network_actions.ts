// Ported from jamaljsr/polar (MIT): src/store/models/network.ts (start, stop),
// src/lib/docker/dockerService.ts (saveComposeFile, start, stop, ensureDirs).

import {mkdir} from 'node:fs/promises';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';

import type {Network} from '../typescript/index.js';
import type {PolarNode} from '../typescript/index.js';
import composeFile from './compose_file.js';
import {nodePath} from './create_nodes.js';
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
    network: <Network Object>
  }

  @returns via Promise
*/
export const saveComposeFile = async ({network}: {network: Network}) => {
  await mkdir(network.path, {recursive: true});

  await writeFile(
    join(network.path, 'docker-compose.yml'),
    composeFile({network}).file,
  );
};

/** Start the containers of a network and wait for the nodes

  The method saves each status change in the networks file

  {
    dataDir: <Data Directory Path String>
    network: <Network Object>
  }

  @throws
  <Error>

  @returns via Promise
*/
export const startNetwork = async ({
  dataDir,
  network,
}: {
  dataDir: string;
  network: Network;
}) => {
  const save = () => saveNetwork({dataDir, network});

  setStatus({network, status: 'Starting'});

  await save();

  try {
    // Move the ports that a different program uses
    const ports = await openPorts({network});

    allNodes(network)
      .filter(n => !!ports?.[n.name])
      .forEach(n => (n.ports = {...n.ports, ...ports?.[n.name]}));

    await save();
    await saveComposeFile({network});

    // Make the volume directories, so that the host user owns them
    for (const node of allNodes(network)) {
      const implementation = node.implementation as DockerImplementation;

      await mkdir(nodePath(network, implementation, node.name), {
        recursive: true,
      });
    }

    await runCompose({args: ['up', '-d'], network});

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

  The node data stays in the volume directories

  {
    dataDir: <Data Directory Path String>
    network: <Network Object>
  }

  @throws
  <Error>

  @returns via Promise
*/
export const stopNetwork = async ({
  dataDir,
  network,
}: {
  dataDir: string;
  network: Network;
}) => {
  const save = () => saveNetwork({dataDir, network});

  network.autoMineMode = 0;

  setStatus({network, status: 'Stopping'});

  await save();

  try {
    await runCompose({args: ['down'], network});

    setStatus({network, status: 'Stopped'});

    await save();
  } catch (err) {
    setStatus({network, status: 'Error'});

    await save();

    throw err;
  }
};
