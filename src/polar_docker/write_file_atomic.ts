import {randomBytes} from 'node:crypto';
import {open} from 'node:fs/promises';
import {rename} from 'node:fs/promises';
import {rm} from 'node:fs/promises';
import {dirname} from 'node:path';

// Sync a folder, so that a rename in the folder stays after a power loss.
// Some systems cannot sync a folder, and the rename is done, so an error
// does not fail the write.
const syncFolder = async (path: string) => {
  try {
    const handle = await open(path, 'r');

    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch {
    return;
  }
};

/** Replace a file in one step

  The text goes to a temporary file in the same folder. The name of the
  temporary file has the process id and random bytes. The temporary file
  goes to the disk (fsync) before a rename replaces the file. Thus a reader
  never gets a part of the text, and a power loss does not leave an empty
  file. If a step fails, the temporary file goes away, and the file does not
  change. The folder must exist.

  {
    path: <File Path String>
    text: <File Text String>
  }

  @throws
  <Error>

  @returns via Promise
*/
export default async (args: {path: string; text: string}) => {
  const random = randomBytes(6).toString('hex');
  const temp = `${args.path}.${process.pid}.${random}.tmp`;

  try {
    const handle = await open(temp, 'w');

    try {
      await handle.writeFile(args.text);
      await handle.sync();
    } finally {
      await handle.close();
    }

    await rename(temp, args.path);
  } catch (err) {
    await rm(temp, {force: true});

    throw err;
  }

  await syncFolder(dirname(args.path));
};
