// Ported from jamaljsr/polar (MIT): src/store/models/mcp/network/listNodeVersions.ts.

import type {ListNodeVersionsArgs} from '../../polar_methods/index.js';
import type {DockerImplementation} from '../docker_configs.js';
import {repoState} from '../docker_configs.js';
import type {ToolArgs} from './types.js';
import {validateDockerImplementation} from './validate.js';

type Versions<T> = {[implementation in DockerImplementation]?: T};

/** List the versions of each node implementation that the backend supports

  Polar also lists the versions of the implementations that the Docker backend
  does not support yet
*/
export default async ({args}: ToolArgs<ListNodeVersionsArgs>) => {
  const implementations = !!args.implementation
    ? [validateDockerImplementation(args.implementation)]
    : (['bitcoind', 'LND'] as DockerImplementation[]);

  const versions: Versions<string[]> = {};
  const latest: Versions<string> = {};
  const compatibility: Versions<{[version: string]: string} | undefined> = {};

  implementations.forEach(implementation => {
    const image = repoState[implementation];

    versions[implementation] = image.versions;
    latest[implementation] = image.latest;
    compatibility[implementation] = image.compatibility;
  });

  return {
    versions,
    latest,
    compatibility,
    message: !!args.implementation
      ? `Available versions for ${args.implementation}`
      : 'All supported node versions in Polar',
  };
};
