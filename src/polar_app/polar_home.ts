// Ported from jamaljsr/polar (MIT): src/utils/config.ts (xdgDataPath,
// dataPath).

import {existsSync} from 'node:fs';
import {join} from 'node:path';

import realPath from './real_path.js';

// The 2 data directories that the Polar app can use, in the Polar order
const candidates = (home: string) => [
  join(home, '.local', 'share', 'polar'),
  join(home, '.polar'),
];

/** Get the data directory of the Polar app

  The Polar app uses <home>/.local/share/polar if that path exists, else
  <home>/.polar. The Polar app does not read XDG_DATA_HOME, so this method
  does not read it.

  {
    home: <Home Directory Path String>
  }

  @returns
  <Polar Data Directory Path String>
*/
export const polarHome = ({home}: {home: string}) => {
  const [xdg, dotPolar] = candidates(home);

  return existsSync(xdg) ? xdg : dotPolar;
};

/** Check if a data directory is a data directory of the Polar app

  Both Polar data directories count, also if the Polar app does not use the
  directory now. A path with a symbolic link to a Polar data directory also
  counts. The paths do not have to exist.

  {
    dataDir: <Data Directory Path String>
    home: <Home Directory Path String>
  }

  @returns
  <Data Directory Is a Polar Data Directory Bool>
*/
export const isPolarHome = ({
  dataDir,
  home,
}: {
  dataDir: string;
  home: string;
}) => {
  const real = realPath(dataDir);

  return candidates(home).some(path => realPath(path) === real);
};
