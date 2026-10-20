import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

/** Stage of a Tool When the Polar App Check Runs */
export type AppCheckStage = 'before-delete' | 'before-save' | 'before-tool';

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

/** Get the data folder object of a data directory

  The data folder is not the Polar app data directory, so the containers get
  the polarln prefix and the Polar app check does nothing

  {
    dataDir: <Resolved Data Directory Path String>
    [docker]: <Run the docker Program Function> // Default: runDocker
  }

  @returns
  <Data Folder Object>
*/
export default (args: {dataDir: string; docker?: DockerRunner}): DataFolder => {
  return {
    assertAppOff: async () => {},
    dataDir: args.dataDir,
    docker: args.docker || runDocker,
    isPolarHome: false,
    prefix: 'polarln',
  };
};
