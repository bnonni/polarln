import {mkdir} from 'node:fs/promises';
import {readFile} from 'node:fs/promises';
import {rename} from 'node:fs/promises';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';

import type {Network} from '../typescript/index.js';

// Version of the networks file format
const fileVersion = 1;

// The last change of each data directory, so that changes run one at a time
const lastChanges = new Map<string, Promise<unknown>>();

const filePath = (dataDir: string) =>
  join(dataDir, 'networks', 'networks.json');

/** Read the networks of a data directory

  {
    dataDir: <Data Directory Path String>
  }

  @throws
  <Error>

  @returns via Promise
  {
    networks: [<Network Object>]
  }
*/
export const readNetworks = async ({dataDir}: {dataDir: string}) => {
  const json = await readFile(filePath(dataDir), 'utf8').catch(err => {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }

    throw err;
  });

  if (json === undefined) {
    return {networks: [] as Network[]};
  }

  const {networks} = JSON.parse(json) as {networks: Network[]};

  return {networks};
};

// Read the file, change the networks, and write the file
const writeChange = async (args: {
  change: (networks: Network[]) => void;
  dataDir: string;
}) => {
  const {networks} = await readNetworks({dataDir: args.dataDir});

  args.change(networks);

  const path = filePath(args.dataDir);
  const temp = `${path}.${process.pid}.tmp`;

  await mkdir(join(args.dataDir, 'networks'), {recursive: true});
  await writeFile(
    temp,
    `${JSON.stringify({networks, version: fileVersion}, null, 2)}\n`,
  );
  await rename(temp, path);

  return {networks};
};

/** Change the networks of a data directory

  The method reads the file again before each change, so that a change does
  not lose the changes of a different process. In one process, the changes
  run one at a time. The new file replaces the old file in one step.

  {
    change: <Change the Networks Array Function>
    dataDir: <Data Directory Path String>
  }

  @throws
  <Error>

  @returns via Promise
  {
    networks: [<Network Object>]
  }
*/
export const changeNetworks = (args: {
  change: (networks: Network[]) => void;
  dataDir: string;
}) => {
  const last = lastChanges.get(args.dataDir) || Promise.resolve();

  const next = last.catch(() => {}).then(() => writeChange(args));

  lastChanges.set(args.dataDir, next);

  return next;
};

/** Get a network by id

  {
    dataDir: <Data Directory Path String>
    id: <Network Id Number or String>
  }

  @throws
  <Error>

  @returns via Promise
  <Network Object>
*/
export const networkById = async (args: {dataDir: string; id: unknown}) => {
  const {networks} = await readNetworks({dataDir: args.dataDir});

  const id = typeof args.id === 'number' ? args.id : parseInt(String(args.id));

  const network = networks.find(n => n.id === id);

  if (!network) {
    throw new Error(`Network with the id '${String(args.id)}' was not found.`);
  }

  return network;
};

/** Save a network in place of the network with the same id

  {
    dataDir: <Data Directory Path String>
    network: <Network Object>
  }

  @throws
  <Error>

  @returns via Promise
*/
export const saveNetwork = async ({
  dataDir,
  network,
}: {
  dataDir: string;
  network: Network;
}) => {
  await changeNetworks({
    change: networks => {
      const index = networks.findIndex(n => n.id === network.id);

      if (index !== -1) {
        networks[index] = network;
      }
    },
    dataDir,
  });
};
