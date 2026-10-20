import {join} from 'node:path';
import {resolve} from 'node:path';
import {sep} from 'node:path';

import realPath from '../polar_app/real_path.js';
import type {Network} from '../typescript/index.js';
import type {PolarError} from '../typescript/index.js';
import type {DataFolder} from './data_folder.js';

const outside = (args: {
  expected: string;
  networkId: number;
  path: string;
}): PolarError => [409, 'NetworkPathOutsideDataFolder', args];

// The system follows a link before a '..' in a path, but the real path check
// removes the '..' first. Thus a path must be absolute and have no '..'.
const isNormal = (path: string) => resolve(path) === path;

/** Check that a network folder and the node files are in the data folder

  The networks file holds absolute paths. A copy of a data folder thus has
  the paths of the original folder. Run this check before a compose command,
  a folder or file change, a move, or a delete, so that a copy does not change
  the original folders.

  The real path of the network folder must be the real path of
  <dataDir>/networks/<id>. Each node file to delete or move must be in the
  network folder. The paths do not have to exist. Each path must be absolute
  and have no '.' or '..' parts, because a '..' after a symbolic link can go
  out of the network folder.

  A network folder outside the data folder gives its path, and the expected
  path <dataDir>/networks/<id>. A node file outside the network folder gives
  its path, and the network folder path as the expected path.

  {
    folder: <Data Folder Object>
    network: <Network Object>
    [paths]: [<Node File or Folder Path String>]
  }

  @throws
  [409, 'NetworkPathOutsideDataFolder', {expected, networkId, path}]
*/
export default ({
  folder,
  network,
  paths = [],
}: {
  folder: DataFolder;
  network: Network;
  paths?: string[];
}) => {
  const expected = join(folder.dataDir, 'networks', `${network.id}`);
  const root = realPath(network.path);

  if (!isNormal(network.path) || root !== realPath(expected)) {
    throw outside({expected, networkId: network.id, path: network.path});
  }

  paths.forEach(path => {
    if (!isNormal(path) || !realPath(path).startsWith(`${root}${sep}`)) {
      throw outside({expected: network.path, networkId: network.id, path});
    }
  });
};
