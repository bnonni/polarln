// Ported from jamaljsr/polar (MIT): src/store/models/mcp/helpers.ts.

import type {DockerImplementation} from '../docker_configs.js';

/** Make sure that there is a network id

  @throws
  <Error>
*/
export const validateNetworkId = (networkId: unknown) => {
  if (!networkId) {
    throw new Error('Network ID is required');
  }
};

/** Make sure that there is a value

  @throws
  <Error>
*/
export const validateRequired = (value: unknown, fieldName: string) => {
  if (!value) {
    throw new Error(`${fieldName} is required`);
  }
};

/** Make sure that the Docker backend supports a node implementation

  @throws
  <Error>

  @returns
  <Docker Implementation String>
*/
export const validateDockerImplementation = (
  implementation: string,
): DockerImplementation => {
  if (implementation !== 'bitcoind' && implementation !== 'LND') {
    throw new Error(`polarDocker does not support ${implementation} nodes yet`);
  }

  return implementation;
};
