import {existsSync} from 'node:fs';
import {join} from 'node:path';

// The file names that docker compose looks for in its working directory, in
// the order that docker compose uses. It uses the first main file and the
// first override file that it finds.
const mainNames = [
  'compose.yaml',
  'compose.yml',
  'docker-compose.yml',
  'docker-compose.yaml',
];

const overrideNames = [
  'compose.override.yml',
  'compose.override.yaml',
  'docker-compose.override.yml',
  'docker-compose.override.yaml',
];

/** Get the compose files that docker compose uses in a network directory

  The Polar app runs docker compose in the network directory with no -f
  option. Then docker compose uses the first main file and the first override
  file of the directory. If the directory has no main file, docker compose
  looks for a file in the parent directories.

  <Network Directory Path String>

  @returns
  {
    [main]: <Main Compose File Name String>
    [override]: <Override Compose File Name String>
  }
*/
export default (path: string) => {
  const find = (names: string[]) => {
    return names.find(name => existsSync(join(path, name)));
  };

  return {main: find(mainNames), override: find(overrideNames)};
};
