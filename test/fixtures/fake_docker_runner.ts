import type {DockerRunner} from '../../src/polar_docker/data_folder.js';

/** Call of the Fake docker Runner */
export type DockerCall = {args: string[]; cwd?: string};

type FakeDockerRunnerArgs = {
  /** Output for Each Call (a thrown value is the rejection) */
  respond?: (call: DockerCall) => string | undefined;
};

/** Get a fake docker runner that records each call and does not run docker */
export const fakeDockerRunner = (args: FakeDockerRunnerArgs = {}) => {
  const calls: DockerCall[] = [];

  const docker: DockerRunner = async (dockerArgs, options) => {
    const call = {args: dockerArgs, cwd: options.cwd};

    calls.push(call);

    return {stderr: '', stdout: args.respond?.(call) ?? ''};
  };

  return {calls, docker};
};
