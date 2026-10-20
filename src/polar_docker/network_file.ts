// Ported from jamaljsr/polar (MIT): src/lib/docker/dockerService.ts
// (saveNetworks, loadNetworks), src/store/models/network.ts (addNetwork,
// remove).

import {readdir} from 'node:fs/promises';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

import type {Network} from '../typescript/index.js';
import type {PolarError} from '../typescript/index.js';
import type {DataFolder} from './data_folder.js';
import lockNetworksFile from './lock_networks_file.js';
import {chartIcons} from './polar_chart.js';
import type {PolarCharts} from './polar_chart.js';
import syncChart from './polar_chart.js';
import {statusCode} from './status_codes.js';
import {statusLabel} from './status_codes.js';
import writeFileAtomic from './write_file_atomic.js';

// Version of the Polar networks file format that polarDocker writes
const fileVersion = '4.0.0';

// The last change of each data directory, so that changes run one at a time
const lastChanges = new Map<string, Promise<unknown>>();

/** Polar Networks File (the keys that polarDocker does not know stay) */
type NetworksFile = {
  [key: string]: unknown;
  charts?: unknown;
  networks: Network[];
  version?: unknown;
};

/** Change the Networks Array and the Charts of the Networks File */
type ChangeNetworks = (networks: Network[], charts: PolarCharts) => void;

// An object with a status number on disk and a status label in memory
type StatusHolder = {status?: unknown};

const filePath = (dataDir: string) =>
  join(dataDir, 'networks', 'networks.json');

const isObject = (value: unknown): value is {[key: string]: unknown} =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const notReadable = (args: {err: string; path: string}): PolarError => [
  503,
  'FailedToReadNetworksFile',
  args,
];

// A node array must have only node objects
const isNodeArray = (nodes: unknown) =>
  Array.isArray(nodes) && nodes.every(isObject);

// A network must have node arrays. Polar v2.0.0 added the tap nodes.
const hasNodeArrays = (network: unknown) => {
  if (!isObject(network) || !isObject(network.nodes)) {
    return false;
  }

  const {bitcoin, lightning, tap} = network.nodes;

  return (
    isNodeArray(bitcoin) &&
    isNodeArray(lightning) &&
    (tap === undefined || isNodeArray(tap))
  );
};

// Polar keeps a status in the network, in each node, and in the simulation
const statusHolders = (network: Network): StatusHolder[] => {
  const {bitcoin, lightning, tap} = network.nodes;
  const {simulation} = network as {simulation?: unknown};

  const holders: StatusHolder[] = [network, ...bitcoin, ...lightning, ...tap];

  if (isObject(simulation) && simulation.status !== undefined) {
    holders.push(simulation);
  }

  return holders;
};

// Change the status numbers of a network from the file to labels
const decodeNetwork = (network: Network) => {
  network.nodes.tap ??= [];

  statusHolders(network).forEach(n => (n.status = statusLabel(n.status)));
};

// Get a copy of a network with the status numbers of the file
const encodeNetwork = (network: Network) => {
  const copy = structuredClone(network);

  statusHolders(copy).forEach(holder => {
    const code = statusCode(holder.status);

    if (code === undefined) {
      throw new Error(
        `polarDocker does not support the status ${JSON.stringify(holder.status)} in network ${network.id}`,
      );
    }

    holder.status = code;
  });

  return copy;
};

// Read and decode the networks file, or get undefined if there is no file
const readNetworksFile = async (path: string) => {
  const json = await readFile(path, 'utf8').catch(err => {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }

    throw err;
  });

  if (json === undefined) {
    return undefined;
  }

  let file: unknown;

  try {
    file = JSON.parse(json);
  } catch (err) {
    throw notReadable({err: (err as Error).message, path});
  }

  if (!isObject(file) || !Array.isArray(file.networks)) {
    throw notReadable({err: 'The file has no networks array', path});
  }

  if (!file.networks.every(hasNodeArrays)) {
    throw notReadable({
      err: 'A network has no node arrays, or a node is not an object',
      path,
    });
  }

  const networksFile = file as NetworksFile;

  networksFile.networks.forEach(decodeNetwork);

  return networksFile;
};

// A different version can have different keys or migrations
const assertVersion = (file: NetworksFile) => {
  if (file.version !== fileVersion) {
    throw new Error(
      `polarDocker does not support the networks file version ${JSON.stringify(file.version)} (only ${fileVersion})`,
    );
  }
};

// Get the charts of a file, and add the charts key that the Polar app needs
const chartsOf = (file: NetworksFile, path: string) => {
  file.charts ??= {};

  if (!isObject(file.charts)) {
    throw notReadable({err: 'The charts key is not an object', path});
  }

  return file.charts;
};

// Get a new networks file, if the data folder can get a new file
const newNetworksFile = async (folder: DataFolder): Promise<NetworksFile> => {
  const networksDir = join(folder.dataDir, 'networks');

  // The Polar home has network folders only with a networks file
  if (folder.isPolarHome) {
    const entries = await readdir(networksDir, {withFileTypes: true}).catch(
      err => {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          return [];
        }

        throw err;
      },
    );

    if (entries.some(n => n.isDirectory() && /^\d+$/.test(n.name))) {
      throw notReadable({
        err: 'The networks file is not there, but the network folders are',
        path: filePath(folder.dataDir),
      });
    }
  }

  return {version: fileVersion, networks: [], charts: {}};
};

/** Check that a change of the networks file can be written

  A file with a different version, with a status that is not a Polar status,
  or with charts that are not an object cannot be written. Run this check
  before a Docker change that a save must follow, so that the save does not
  fail for these causes. A missing file passes.

  {
    folder: <Data Folder Object>
  }

  @throws
  <Error>
  [503, 'FailedToReadNetworksFile', {err, path}]

  @returns via Promise
*/
export const assertNetworksFileWritable = async ({
  folder,
}: {
  folder: DataFolder;
}) => {
  const path = filePath(folder.dataDir);
  const file = await readNetworksFile(path);

  if (!file) {
    return;
  }

  assertVersion(file);
  chartsOf(file, path);

  file.networks.forEach(encodeNetwork);
};

/** Read the networks of a data folder

  The status numbers of the file become labels. A missing file has no
  networks.

  {
    folder: <Data Folder Object>
  }

  @throws
  <Error>
  [503, 'FailedToReadNetworksFile', {err, path}]

  @returns via Promise
  {
    networks: [<Network Object>]
  }
*/
export const readNetworks = async ({folder}: {folder: DataFolder}) => {
  const file = await readNetworksFile(filePath(folder.dataDir));

  return {networks: file?.networks || []};
};

// Sync the chart of each new or changed network, as the Polar app needs a
// chart node for each node. Remove the chart of each removed network.
const syncCharts = (args: {
  before: Map<number, string>;
  charts: PolarCharts;
  networks: Network[];
}) => {
  const icons = chartIcons({charts: args.charts, networks: args.networks});
  const ids = new Set(args.networks.map(n => n.id));

  args.before.forEach((_, id) => {
    if (!ids.has(id)) {
      delete args.charts[id];
    }
  });

  args.networks.forEach(network => {
    const before = args.before.get(network.id);

    if (before === JSON.stringify(network)) {
      return;
    }

    // A new network gets a new chart, as in Polar addNetwork
    if (before === undefined) {
      delete args.charts[network.id];
    }

    args.charts[network.id] = syncChart({
      chart: args.charts[network.id],
      icons,
      network,
    });
  });
};

// Read the file, change the networks, and write the file, with the lock held
const writeChange = (args: {change: ChangeNetworks; folder: DataFolder}) =>
  lockNetworksFile({
    dataDir: args.folder.dataDir,
    use: async () => {
      const path = filePath(args.folder.dataDir);

      const file =
        (await readNetworksFile(path)) || (await newNetworksFile(args.folder));

      assertVersion(file);

      const charts = chartsOf(file, path);
      const before = new Map(file.networks.map(n => [n.id, JSON.stringify(n)]));

      args.change(file.networks, charts);

      const networks = file.networks.map(encodeNetwork);

      syncCharts({before, charts, networks: file.networks});

      // The spread keeps the key order and the keys that polarDocker does not
      // know
      const json = JSON.stringify({...file, networks}, null, 2);

      // The lock made the networks folder. Polar writes the file with no
      // end newline.
      await writeFileAtomic({path, text: json});

      return {networks: file.networks};
    },
  });

/** Change the networks of a data folder

  The method reads the file again before each change, so that a change does
  not lose the changes of a different process. In one process, the changes
  run one at a time. Between processes, the lock of the networks file makes
  the read, the change, and the write run one at a time. The new file
  replaces the old file in one step.

  The file has the Polar v4.0.0 format: the status labels become numbers, and
  the version, the key order, and the unknown keys stay. A file with a
  different version, or with a status that is not a Polar status, does not
  change. A file that is not valid JSON does not change.

  The change gets the charts of the file, with the network id as the key.
  After the change, the chart of each new or changed network matches the
  network, and the chart of each removed network goes away. The charts of the
  other networks stay the same.

  {
    change: <Change the Networks Array and the Charts Function>
    folder: <Data Folder Object>
  }

  @throws
  <Error>
  [409, 'NetworksFileBusy', {dataDir}]
  [503, 'FailedToReadNetworksFile', {err, path}]

  @returns via Promise
  {
    networks: [<Network Object>]
  }
*/
export const changeNetworks = (args: {
  change: ChangeNetworks;
  folder: DataFolder;
}) => {
  const {dataDir} = args.folder;
  const last = lastChanges.get(dataDir) || Promise.resolve();

  const next = last.catch(() => {}).then(() => writeChange(args));

  lastChanges.set(dataDir, next);

  return next;
};

/** Get a network by id

  {
    folder: <Data Folder Object>
    id: <Network Id Number or String>
    [message]: <Not Found Error Message String>
  }

  @throws
  <Error>
  [503, 'FailedToReadNetworksFile', {err, path}]

  @returns via Promise
  <Network Object>
*/
export const networkById = async (args: {
  folder: DataFolder;
  id: unknown;
  message?: string;
}) => {
  const {networks} = await readNetworks({folder: args.folder});

  const id = typeof args.id === 'number' ? args.id : parseInt(String(args.id));

  const network = networks.find(n => n.id === id);

  if (!network) {
    throw new Error(
      args.message || `Network with the id '${String(args.id)}' was not found.`,
    );
  }

  return network;
};

/** Save a network in place of the network with the same id

  {
    folder: <Data Folder Object>
    network: <Network Object>
  }

  @throws
  <Error>
  [409, 'NetworksFileBusy', {dataDir}]
  [503, 'FailedToReadNetworksFile', {err, path}]

  @returns via Promise
*/
export const saveNetwork = async ({
  folder,
  network,
}: {
  folder: DataFolder;
  network: Network;
}) => {
  await changeNetworks({
    change: networks => {
      const index = networks.findIndex(n => n.id === network.id);

      if (index !== -1) {
        networks[index] = network;
      }
    },
    folder,
  });
};
