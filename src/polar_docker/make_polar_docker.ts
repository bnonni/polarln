import {join} from 'node:path';
import {resolve} from 'node:path';

import {isPolarHome} from '../polar_app/polar_home.js';
import type {PolarDocker} from '../typescript/index.js';
import dataFolder from './data_folder.js';
import type {DockerRunner} from './data_folder.js';
import executeTool from './execute_tool.js';

/** Arguments of the Internal Docker Backend Maker */
export type MakePolarDockerArgs = {
  /** Data Directory Path */
  dataDir?: string;
  /** Run the docker Program (tests give a fake) */
  docker?: DockerRunner;
  /** Environment Variables */
  env: NodeJS.ProcessEnv;
  /** Home Directory Path */
  home: string;
};

/** Make a Polar Docker backend object

  This is the internal maker of polarDocker. The tests give an explicit home
  directory and environment, so that they never use the real home directory.

  If the data directory is a data directory of the Polar app in the home
  directory, the containers and the compose projects get the Polar names.

  {
    [dataDir]: <Data Directory Path String>
    [docker]: <Run the docker Program Function>
    env: <Environment Variables Object>
    home: <Home Directory Path String>
  }

  @returns
  {
    polar: <Polar Docker Backend Object>
  }
*/
export default (args: MakePolarDockerArgs): {polar: PolarDocker} => {
  const dir =
    args.dataDir || args.env.POLARLN_DATA_DIR || join(args.home, '.polarln');

  const dataDir = resolve(dir);

  const folder = dataFolder({
    dataDir,
    docker: args.docker,
    isPolarHome: isPolarHome({dataDir, home: args.home}),
  });

  return {
    polar: {
      dataDir: folder.dataDir,
      execute: (tool, toolArgs) => executeTool({args: toolArgs, folder, tool}),
    },
  };
};
