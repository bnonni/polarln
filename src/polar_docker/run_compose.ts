import {execFile} from 'node:child_process';
import {userInfo} from 'node:os';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {stripVTControlCharacters} from 'node:util';

import type {Network} from '../typescript/index.js';

const run = promisify(execFile);

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
    const {message, stderr} = err as {message: string; stderr?: string};

    throw new Error(stripVTControlCharacters(stderr?.trim() || message), {
      cause: err,
    });
  }
};
