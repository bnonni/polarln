import {stat} from 'node:fs/promises';
import {userInfo} from 'node:os';
import {stripVTControlCharacters} from 'node:util';

import type {Network} from '../typescript/index.js';
import composeFiles from './compose_files.js';
import type {DataFolder} from './data_folder.js';
import {projectName} from './node_names.js';

// docker compose: "Cannot connect to the Docker daemon at ...". docker 29:
// "failed to connect to the docker API at ...", "permission denied while
// trying to connect to the docker API at ..."
const dockerDown = /connect to the docker (?:daemon|API)\b/i;

type ComposeFailure = {code?: unknown; message: string; stderr?: string};

/** Get the error of a failed docker compose command

  The message of a missing or stopped Docker starts with "Docker is not
  available"

  {
    err: <Failed Command Error Object>
    hasDir: <Network Directory Exists Bool>
    path: <Network Directory Path String>
  }

  @returns
  <Error>
*/
export const composeError = (args: {
  err: ComposeFailure;
  hasDir: boolean;
  path: string;
}) => {
  const {err} = args;

  const detail = stripVTControlCharacters(err.stderr?.trim() || err.message);

  // A missing working directory also gives ENOENT
  if (err.code === 'ENOENT' && !args.hasDir) {
    return new Error(`Network directory ${args.path} does not exist`, {
      cause: err,
    });
  }

  if (err.code === 'ENOENT' || dockerDown.test(detail)) {
    return new Error(`Docker is not available: ${detail}`, {cause: err});
  }

  return new Error(detail, {cause: err});
};

/** Run a docker compose command in the directory of a network

  As in Polar, the command runs in the network directory with no -f option.
  Thus docker compose uses the compose file and the override file of the
  directory. The network directory must have a compose file, else docker
  compose uses a file of a parent directory.

  The -p option gives the project name of the container check. Thus the
  COMPOSE_PROJECT_NAME variable and the name in the compose file cannot
  change the project. The COMPOSE_FILE variable cannot change the compose
  file.

  On Linux, the containers get the host user and group ids, so that they can
  write the volume directories. The command runs with the docker runner of the
  data folder.

  {
    args: [<docker compose Argument String>]
    folder: <Data Folder Object>
    network: <Network Object>
  }

  @throws
  <Error>

  @returns via Promise
  {
    out: <Command Output String> // Standard output, else standard error
    stdout: <Standard Output String>
  }
*/
export default async ({
  args,
  folder,
  network,
}: {
  args: string[];
  folder: DataFolder;
  network: Network;
}) => {
  const {gid, uid} = userInfo();

  const ids =
    process.platform === 'linux' ? {GROUPID: `${gid}`, USERID: `${uid}`} : {};

  const {
    COMPOSE_FILE: _file,
    COMPOSE_PROJECT_NAME: _project,
    ...env
  } = process.env;

  const hasDir = () =>
    stat(network.path).then(
      stats => stats.isDirectory(),
      () => false,
    );

  // With no compose file, docker compose uses a file of a parent directory
  if (!composeFiles(network.path).main) {
    const reason = (await hasDir()) ? 'has no compose file' : 'does not exist';

    throw new Error(`Network directory ${network.path} ${reason}`);
  }

  const project = projectName(network, folder.prefix);

  try {
    const {stderr, stdout} = await folder.docker(
      ['compose', '-p', project, ...args],
      {
        cwd: network.path,
        env: {...env, ...ids},
      },
    );

    return {
      out: stripVTControlCharacters(stdout || stderr),
      stdout: stripVTControlCharacters(stdout),
    };
  } catch (err) {
    throw composeError({
      err: err as ComposeFailure,
      hasDir: await hasDir(),
      path: network.path,
    });
  }
};
