import {realpathSync} from 'node:fs';
import {basename} from 'node:path';
import {dirname} from 'node:path';
import {join} from 'node:path';
import {resolve} from 'node:path';

/** Get the real path of a path that can be missing

  The symbolic links in the path are resolved. If the path is not there, the
  real path of the nearest folder above it gets the missing names. Thus 2
  paths to the same place give the same real path, also before the place
  exists.

  <Path String>

  @returns
  <Real Path String>
*/
const realPath = (path: string): string => {
  const full = resolve(path);

  try {
    return realpathSync(full);
  } catch {
    const parent = dirname(full);

    // The root of the file system has no folder above it
    if (parent === full) {
      return full;
    }

    return join(realPath(parent), basename(full));
  }
};

export default realPath;
