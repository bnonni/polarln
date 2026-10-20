import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

import type {PolarAppCheck} from '../polar_app/check_polar_app.js';
import type {PolarError} from '../typescript/index.js';

/** Stage of a Tool When the Polar App Check Runs */
export type AppCheckStage = 'before-delete' | 'before-save' | 'before-tool';

/** Check if the Polar App Runs (rejects if the result is not clear) */
export type CheckApp = () => Promise<PolarAppCheck>;

/** Prefix of the Container Names and the Compose Project Names */
export type ContainerPrefix = 'polar' | 'polarln';

/** Run the docker Program With Arguments */
export type DockerRunner = (
  args: string[],
  options: {cwd?: string; env?: NodeJS.ProcessEnv},
) => Promise<{stderr: string; stdout: string}>;

/** Data Folder of the Docker Backend */
export type DataFolder = {
  /** Reject if the Polar App Runs, Before a Change to the Data Folder */
  assertAppOff: (args: {stage: AppCheckStage}) => Promise<void>;
  /** Data Directory Path */
  dataDir: string;
  /** Run the docker Program */
  docker: DockerRunner;
  /** The Data Directory Is the Polar App Data Directory */
  isPolarHome: boolean;
  /** Prefix of the Container Names and the Compose Project Names */
  prefix: ContainerPrefix;
};

const appRunsHint =
  'The Polar app runs. polarln does not change the Polar files while the ' +
  'app runs. Use --backend bridge, or quit the app.';

const run = promisify(execFile);

/** Run the docker program

  [<docker Argument String>]
  {
    [cwd]: <Working Directory Path String>
    [env]: <Environment Variables Object>
  }

  @rejects
  <Failed Command Error>

  @returns via Promise
  {
    stderr: <Standard Error Output String>
    stdout: <Standard Output String>
  }
*/
export const runDocker: DockerRunner = (args, options) =>
  run('docker', args, options);

// A Polar home folder with no app check must not change, so the check fails
const noCheckApp: CheckApp = async () => {
  throw new Error('The data folder has no Polar app check');
};

/** Get the data folder object of a data directory

  In the Polar app data directory, the containers and the compose projects
  get the Polar names: polar-n<id>-<name> and polar-network-<id>. In a
  different data directory, they get the polarln prefix, so that they do not
  use the names of the Polar app containers.

  The Polar app reads the networks file one time at its start, and it writes
  all of its networks at each save. Thus a change to the Polar files while
  the app runs is lost, or it breaks the app. In the Polar app data
  directory, assertAppOff rejects if the app runs, or if the app check has no
  clear result. In a different data directory, assertAppOff does nothing.

  {
    [checkApp]: <Check if the Polar App Runs Function> // Default: rejects
    dataDir: <Resolved Data Directory Path String>
    [docker]: <Run the docker Program Function> // Default: runDocker
    [isPolarHome]: <Data Directory Is the Polar App Data Directory Bool>
  }

  @returns
  <Data Folder Object>

  The assertAppOff method of the object rejects with:
  [409, 'PolarAppIsRunning', {dataDir, found, hint, pid|url, stage}]
  [503, 'FailedToCheckPolarApp', {dataDir, err}]
*/
export default (args: {
  checkApp?: CheckApp;
  dataDir: string;
  docker?: DockerRunner;
  isPolarHome?: boolean;
}): DataFolder => {
  const {dataDir} = args;
  const checkApp = args.checkApp || noCheckApp;
  const isPolarHome = !!args.isPolarHome;

  const assertAppOff = async ({stage}: {stage: AppCheckStage}) => {
    if (!isPolarHome) {
      return;
    }

    let check: PolarAppCheck;

    try {
      check = await checkApp();
    } catch (err) {
      throw [503, 'FailedToCheckPolarApp', {dataDir, err}] satisfies PolarError;
    }

    if (!check.runs) {
      return;
    }

    const {runs: _runs, ...found} = check;

    throw [
      409,
      'PolarAppIsRunning',
      {dataDir, ...found, hint: appRunsHint, stage},
    ] satisfies PolarError;
  };

  return {
    assertAppOff,
    dataDir,
    docker: args.docker || runDocker,
    isPolarHome,
    prefix: isPolarHome ? 'polar' : 'polarln',
  };
};
