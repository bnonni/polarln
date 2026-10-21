import {resolve} from 'node:path';

import checkPolarApp from '../polar_app/check_polar_app.js';
import {isPolarHome} from '../polar_app/polar_home.js';
import {polarHome} from '../polar_app/polar_home.js';
import type {PolarDocker} from '../typescript/index.js';
import type {PolarError} from '../typescript/index.js';
import dataFolder from './data_folder.js';
import type {CheckApp} from './data_folder.js';
import type {DockerRunner} from './data_folder.js';
import type executeTool from './execute_tool.js';

/** Load the Tool Runner Module */
export type LoadExecuteTool = () => Promise<{default: typeof executeTool}>;

// The tool runner loads @grpc/grpc-js and @grpc/proto-loader. Thus it loads
// at the first tool call, and an import of polarln stays fast.
const loadExecuteTool: LoadExecuteTool = () => import('./execute_tool.js');

// Load the tool runner, or reject with a PolarError
const loadTool = async (load: LoadExecuteTool) => {
  try {
    return (await load()).default;
  } catch (err) {
    throw [503, 'FailedToLoadDockerBackend', {err}] satisfies PolarError;
  }
};

/** Arguments of the Internal Docker Backend Maker */
export type MakePolarDockerArgs = {
  /** Check if the Polar App Runs (tests give a fake) */
  checkApp?: CheckApp;
  /** Data Directory Path */
  dataDir?: string;
  /** Run the docker Program (tests give a fake) */
  docker?: DockerRunner;
  /** Environment Variables */
  env: NodeJS.ProcessEnv;
  /** Home Directory Path */
  home: string;
  /** Load the Tool Runner Module (tests give a fake) */
  loadExecuteTool?: LoadExecuteTool;
};

/** Make a Polar Docker backend object

  This is the internal maker of polarDocker. The tests give an explicit home
  directory and environment, so that they never use the real home directory.

  The data directory is the dataDir argument, then POLARLN_DATA_DIR in the
  environment, then the data directory of the Polar app in the home
  directory: <home>/.local/share/polar if that path exists, else
  <home>/.polar.

  If the data directory is a data directory of the Polar app in the home
  directory, the containers and the compose projects get the Polar names.
  Also, the tools that change files or containers first check that the
  Polar app does not run. The check probes the Polar bridge on the port of
  POLAR_MCP_PORT in the environment, else on port 37373, and then scans the
  processes. The public polarDocker method has no option to turn off the
  check.

  The maker does not load the tool runner. The first execute call loads it,
  with @grpc/grpc-js. If the tool runner cannot load, execute rejects with
  FailedToLoadDockerBackend.

  {
    [checkApp]: <Check if the Polar App Runs Function>
    [dataDir]: <Data Directory Path String>
    [docker]: <Run the docker Program Function>
    env: <Environment Variables Object>
    home: <Home Directory Path String>
    [loadExecuteTool]: <Load the Tool Runner Module Function>
  }

  @returns
  {
    polar: <Polar Docker Backend Object>
  }
*/
export default (args: MakePolarDockerArgs): {polar: PolarDocker} => {
  const dir =
    args.dataDir || args.env.POLARLN_DATA_DIR || polarHome({home: args.home});

  const dataDir = resolve(dir);

  const folder = dataFolder({
    checkApp: args.checkApp || (() => checkPolarApp({env: args.env})),
    dataDir,
    docker: args.docker,
    isPolarHome: isPolarHome({dataDir, home: args.home}),
  });

  return {
    polar: {
      dataDir: folder.dataDir,
      execute: async (tool, toolArgs) => {
        const run = await loadTool(args.loadExecuteTool || loadExecuteTool);

        return run({args: toolArgs, folder, tool});
      },
    },
  };
};
