import {open} from 'node:fs/promises';
import type {FileHandle} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

/** Run a step before each sync of a file handle, until the restore

  The spy changes the sync method of the file handle prototype. The tests
  must call the restore function after the spy, in a finally block.

  <Run Before Each Sync Function>

  @returns via Promise
  <Restore the Sync Method Function>
*/
export const spyOnSync = async (step: () => void) => {
  const handle = await open(fileURLToPath(import.meta.url), 'r');
  const prototype = Object.getPrototypeOf(handle) as FileHandle;

  await handle.close();

  const {sync} = prototype;

  prototype.sync = function (this: FileHandle) {
    step();

    return sync.call(this);
  };

  return () => {
    prototype.sync = sync;
  };
};
