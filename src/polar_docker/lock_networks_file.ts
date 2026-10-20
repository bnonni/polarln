import {mkdir} from 'node:fs/promises';
import {rm} from 'node:fs/promises';
import {stat} from 'node:fs/promises';
import {join} from 'node:path';

import type {PolarError} from '../typescript/index.js';
import {delay} from './wait_for.js';

/** Arguments of the Networks File Lock */
type LockNetworksFileArgs<T> = {
  /** Data Directory Path */
  dataDir: string;
  /** Milliseconds Between the Tries (default: 25) */
  interval?: number;
  /** Age in Milliseconds of a Lock From a Process That Stopped (default: 30 s) */
  stale?: number;
  /** Maximum Milliseconds to Wait for the Lock (default: 3 s) */
  timeout?: number;
  /** Function to Run While the Lock Is Held */
  use: () => Promise<T>;
};

const isCode = (err: unknown, code: string) =>
  (err as NodeJS.ErrnoException).code === code;

/** Run a function while the lock of the networks file is held

  The lock is the folder <dataDir>/networks/networks.json.lock. mkdir makes
  the folder in one step, so only one process gets the lock. This also works
  between PID namespaces and between different temporary folders. The Polar
  app reads networks.json by its name, so the lock has no effect on the app.

  A process that stops while it holds the lock leaves the lock folder. A lock
  folder that is older than the stale age is from such a process, and the
  method replaces it. The method removes the lock after the function.

  {
    dataDir: <Data Directory Path String>
    [interval]: <Milliseconds Between the Tries Number> // Default: 25
    [stale]: <Stale Lock Age Milliseconds Number> // Default: 30000
    [timeout]: <Maximum Wait Milliseconds Number> // Default: 3000
    use: <Function to Run While the Lock Is Held>
  }

  @rejects
  [409, 'NetworksFileBusy', {dataDir}]
  <Error>

  @returns via Promise
  <Result of the Function>
*/
export default async <T>(args: LockNetworksFileArgs<T>): Promise<T> => {
  const networksDir = join(args.dataDir, 'networks');
  const lock = join(networksDir, 'networks.json.lock');

  const end = Date.now() + (args.timeout ?? 3000);
  const interval = args.interval ?? 25;
  const stale = args.stale ?? 30_000;

  await mkdir(networksDir, {recursive: true});

  while (true) {
    try {
      await mkdir(lock);

      break;
    } catch (err) {
      if (!isCode(err, 'EEXIST')) {
        throw err;
      }
    }

    const held = await stat(lock).catch(err => {
      // The lock ended after the mkdir, so try again at once
      if (isCode(err, 'ENOENT')) {
        return undefined;
      }

      throw err;
    });

    if (!held) {
      continue;
    }

    if (Date.now() - held.mtimeMs > stale) {
      await rm(lock, {force: true, recursive: true});

      continue;
    }

    if (Date.now() + interval > end) {
      const busy: PolarError = [
        409,
        'NetworksFileBusy',
        {dataDir: args.dataDir},
      ];

      throw busy;
    }

    await delay(interval);
  }

  try {
    return await args.use();
  } finally {
    await rm(lock, {force: true, recursive: true});
  }
};
