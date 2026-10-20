import {execFile} from 'node:child_process';
import {stat} from 'node:fs/promises';
import {userInfo} from 'node:os';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {stripVTControlCharacters} from 'node:util';

import type {Network} from '../typescript/index.js';

// docker compose: "Cannot connect to the Docker daemon at ...". docker 29:
// "failed to connect to the docker API at ...", "permission denied while
// trying to connect to the docker API at ..."
const dockerDown = /connect to the docker (?:daemon|API)\b/i;
const run = promisify(execFile);

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

  On Linux, the containers get the host user and group ids, so that they can
  write the volume directories

  {
    args: [<docker compose Argument String>]
    network: <Network Object>
  }

  @throws
  <Error>

  @returns via Promise
  {
    out: <Command Output String>
  }
*/
export default async ({args, network}: {args: string[]; network: Network}) => {
  const {gid, uid} = userInfo();

  const ids =
    process.platform === 'linux' ? {GROUPID: `${gid}`, USERID: `${uid}`} : {};

  const file = join(network.path, 'docker-compose.yml');

  try {
    const {stderr, stdout} = await run(
      'docker',
      ['compose', '-f', file, ...args],
      {
        cwd: network.path,
        env: {...process.env, ...ids},
      },
    );

    return {out: stripVTControlCharacters(stdout || stderr)};
  } catch (err) {
    const hasDir = await stat(network.path).then(
      stats => stats.isDirectory(),
      () => false,
    );

    throw composeError({
      err: err as ComposeFailure,
      hasDir,
      path: network.path,
    });
  }
};
