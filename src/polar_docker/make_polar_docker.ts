import {join} from 'node:path';
import {resolve} from 'node:path';

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

  const folder = dataFolder({
    dataDir: resolve(dir),
    docker: args.docker,
  });

  return {
    polar: {
      dataDir: folder.dataDir,
      execute: (tool, toolArgs) => executeTool({args: toolArgs, folder, tool}),
    },
  };
};
