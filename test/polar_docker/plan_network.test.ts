import {deepStrictEqual} from 'node:assert/strict';
import {throws} from 'node:assert/strict';
import test from 'node:test';

import planNetwork from '../../src/polar_docker/plan_network.js';
import type {NodeRequest} from '../../src/polar_docker/plan_network.js';

const tests: {
  args: {nodes?: NodeRequest[]};
  description: string;
  error?: string;
  expected?: ReturnType<typeof planNetwork>;
}[] = [
  {
    args: {},
    description: 'No nodes means 2 LND nodes and 1 bitcoind node',
    expected: {
      additional: [],
      bitcoindNodes: 1,
      bitcoindVersion: '30.0',
      lndNodes: 2,
    },
  },
  {
    args: {nodes: []},
    description: 'An empty list means no nodes',
    expected: {
      additional: [],
      bitcoindNodes: 0,
      bitcoindVersion: '30.0',
      lndNodes: 0,
    },
  },
  {
    args: {
      nodes: [
        {implementation: 'LND', version: '0.18.3-beta'},
        {count: 2, implementation: 'LND'},
        {implementation: 'bitcoind', version: ' 27.0 '},
      ],
    },
    description: 'Nodes at other versions come after the base nodes',
    expected: {
      additional: [
        {implementation: 'bitcoind', version: '27.0'},
        {implementation: 'LND', version: '0.18.3-beta'},
      ],
      bitcoindNodes: 0,
      bitcoindVersion: '30.0',
      lndNodes: 2,
    },
  },
  {
    args: {nodes: [{implementation: 'tapd'}]},
    description: 'The Docker backend supports only bitcoind and LND',
    error:
      'Unsupported implementation "tapd". Supported implementations: bitcoind, LND.',
  },
  {
    args: {nodes: [{implementation: '' as 'LND'}]},
    description: 'Each node needs an implementation',
    error: 'Each node entry must include an implementation.',
  },
  {
    args: {nodes: [{count: 1.5, implementation: 'LND'}]},
    description: 'A count must be a positive integer',
    error: 'Invalid count "1.5" for LND. Provide a positive integer value.',
  },
  {
    args: {nodes: [{implementation: 'bitcoind', version: '1.0'}]},
    description: 'A version must be a known version',
    error:
      'Version "1.0" is not supported for bitcoind. ' +
      'Supported versions: 30.0, 29.0, 28.0, 27.0, 26.0.',
  },
  {
    args: {nodes: [{implementation: 'LND'}]},
    description: 'LND nodes need a bitcoind node',
    error:
      'Lightning nodes require at least one bitcoind backend. ' +
      'Add a bitcoind entry to the nodes list.',
  },
  {
    args: {
      nodes: [
        {implementation: 'LND', version: '0.18.3-beta'},
        {implementation: 'bitcoind'},
      ],
    },
    description: 'An old LND version needs an old bitcoind version',
    error:
      'LND version 0.18.3-beta requires a bitcoind node at version 27.0 ' +
      'or lower. Add a compatible bitcoind node.',
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, () => {
    if (!!error) {
      throws(() => planNetwork(args), new Error(error), 'Got error');
    } else {
      deepStrictEqual(planNetwork(args), expected, 'Got plan');
    }

    return;
  });
});
