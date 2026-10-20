import {deepStrictEqual} from 'node:assert/strict';
import test from 'node:test';

import errorFromPolar from '../../src/polar_bridge/error_from_polar.js';

const tool = 'tool';

const tests = [
  ['Unknown tool: list_things', 501, 'PolarToolNotSupported'],
  [
    'polarDocker does not support eclair nodes yet',
    501,
    'PolarToolNotSupported',
  ],
  ['Tool execution timed out', 504, 'PolarToolTimedOut'],
  ['Failed to get tool definitions - timeout', 504, 'PolarToolTimedOut'],
  ["Network with the id '99' was not found.", 404, 'PolarNetworkNotFound'],
  ['Network with ID 99 not found', 404, 'PolarNetworkNotFound'],
  ['Node "carol" not found in network "n"', 404, 'PolarNodeNotFound'],
  ['Tap node "carol" not found in network', 404, 'PolarNodeNotFound'],
  ['Network has no Bitcoin or Lightning nodes', 404, 'PolarNodeNotFound'],
  ['Zip file does not exist at path: /x.zip', 404, 'PolarObjectNotFound'],
  ['Network ID is required', 400, 'PolarRejectedArguments'],
  ['Number of blocks must be greater than 0', 400, 'PolarRejectedArguments'],
  ['Cannot open channel between the same node', 400, 'PolarRejectedArguments'],
  [
    'Docker is not available: Cannot connect to the Docker daemon',
    503,
    'DockerNotAvailable',
  ],
  [
    'Network directory /home/u/timeout-runs/networks/1 does not exist',
    404,
    'PolarObjectNotFound',
  ],
  ['insufficient funds available', 503, 'PolarToolFailed'],
] as const;

tests.forEach(([err, code, message]) => {
  test(`"${err}" maps to ${code} ${message}`, () => {
    deepStrictEqual(errorFromPolar({err, tool}), [code, message, {err, tool}]);
  });
});
