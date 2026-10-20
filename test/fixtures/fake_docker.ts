import type {PolarDocker} from '../../src/index.js';
import type {DockerMakerArgs} from '../../src/polar_cli/index.js';

export type FakeExecute = {args: object; tool: string};

type FakeDockerArgs = {
  /** Result for Each Tool Call (a thrown value is the rejection) */
  respond?: (call: FakeExecute) => unknown;
};

/** Get a Docker backend factory with a fake execute that records each call */
export const fakeDocker = (args: FakeDockerArgs = {}) => {
  const executed: FakeExecute[] = [];
  const made: DockerMakerArgs[] = [];

  const make = (makeArgs: DockerMakerArgs): {polar: PolarDocker} => {
    made.push(makeArgs);

    const execute = async (tool: string, toolArgs: object) => {
      executed.push({args: toolArgs, tool});

      return args.respond?.({args: toolArgs, tool}) ?? {success: true};
    };

    return {polar: {dataDir: makeArgs.dataDir, execute}};
  };

  return {executed, made, make};
};
