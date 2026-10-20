import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {relative} from 'node:path';

/** Get the sha256 of each file in a folder, and the names of the folders

  A folder gets the value 'folder'. The list is in path order.

  <Folder Path String>

  @returns via Promise
  [[<Relative Path String>, <sha256 Hex String or 'folder'>]]
*/
export const snapshot = async (dir: string) => {
  const entries = await readdir(dir, {recursive: true, withFileTypes: true});

  const items: [string, string][] = [];

  for (const entry of entries) {
    const path = join(entry.parentPath, entry.name);

    if (entry.isDirectory()) {
      items.push([relative(dir, path), 'folder']);
    } else {
      const hash = createHash('sha256').update(await readFile(path));

      items.push([relative(dir, path), hash.digest('hex')]);
    }
  }

  return items.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
};
