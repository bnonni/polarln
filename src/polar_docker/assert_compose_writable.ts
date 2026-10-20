import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

import type {Network} from '../typescript/index.js';
import type {PolarError} from '../typescript/index.js';
import type {PolarNode} from '../typescript/index.js';
import assertNetworkPath from './assert_network_path.js';
import composeFiles from './compose_files.js';
import type {DataFolder} from './data_folder.js';
import runCompose from './run_compose.js';

// Node implementations that the compose file of polarDocker can hold
const writable = new Set<string>(['bitcoind', 'LND']);

const isObject = (value: unknown): value is {[key: string]: unknown} =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const allNodes = (network: Network): PolarNode[] => {
  const {bitcoin, lightning, tap} = network.nodes;

  return [...bitcoin, ...lightning, ...tap];
};

// Get the services of a compose file that polarDocker wrote. polarDocker
// writes JSON with only a name and services. A different file gives nothing.
const jsonServices = (text: string) => {
  try {
    const file: unknown = JSON.parse(text);

    const isOwn =
      isObject(file) &&
      isObject(file.services) &&
      Object.keys(file).every(key => key === 'name' || key === 'services');

    return isOwn ? Object.keys(file.services as object) : undefined;
  } catch {
    return undefined;
  }
};

// Get the services of the compose files of a network, or nothing if the
// network has no compose file. Docker compose reads the files as in a start,
// so the services of an override file are also in the list. A file that
// polarDocker did not write, for example a Polar YAML file, and an override
// file go to docker compose.
const composeServices = async (args: {
  folder: DataFolder;
  network: Network;
}) => {
  const {main, override} = composeFiles(args.network.path);

  if (!main) {
    return undefined;
  }

  const path = join(args.network.path, main);

  // polarDocker writes only docker-compose.yml
  if (main === 'docker-compose.yml' && !override) {
    const own = jsonServices(await readFile(path, 'utf8'));

    if (!!own) {
      return {path, services: own};
    }
  }

  const {stdout} = await runCompose({
    args: ['config', '--services'],
    folder: args.folder,
    network: args.network,
  });

  const services = stdout
    .split('\n')
    .map(line => line.trim())
    .filter(line => !!line);

  return {path, services};
};

/** Get the first node of a network that a polarDocker compose file cannot hold

  polarDocker writes compose files for bitcoind and LND nodes only

  <Network Object>

  @returns
  <Node Object> or undefined
*/
export const unsupportedNode = (network: Network): PolarNode | undefined =>
  allNodes(network).find(n => !writable.has(n.implementation));

/** Check that polarDocker can write a new compose file for a network

  Run this check before a tool changes the nodes of a network. A new compose
  file has only the nodes of the network. Thus the check refuses:
  - A network with a node that polarDocker cannot write (tapd, litd,
    c-lightning, eclair, or btcd).
  - A compose file with a service that is not a node, for example a service
    that a user added. A new file deletes the service.

  A compose file that does not have a node service passes, because the new
  file adds the service. The network folder must be in the data folder. A
  compose file that polarDocker did not write goes to docker compose config.
  The config command reads the files as in a start, so the services of an
  override file also count.

  {
    folder: <Data Folder Object>
    network: <Network Object>
  }

  @throws
  [409, 'ComposeFileHasOtherServices', {networkId, path, services}]
  [409, 'NetworkPathOutsideDataFolder', {expected, networkId, path}]
  <Error>

  @returns via Promise
*/
export default async ({
  folder,
  network,
}: {
  folder: DataFolder;
  network: Network;
}) => {
  // A copy of a data folder must not read the compose file of the original
  assertNetworkPath({folder, network});

  const node = unsupportedNode(network);

  if (!!node) {
    throw new Error(
      `polarDocker does not support ${node.implementation} nodes yet`,
    );
  }

  const compose = await composeServices({folder, network});

  if (!compose) {
    return;
  }

  const names = new Set(allNodes(network).map(n => n.name));

  const services = compose.services.filter(name => !names.has(name));

  if (!!services.length) {
    throw [
      409,
      'ComposeFileHasOtherServices',
      {networkId: network.id, path: compose.path, services},
    ] satisfies PolarError;
  }
};
