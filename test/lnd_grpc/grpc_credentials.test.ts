import {equal} from 'node:assert/strict';
import {throws} from 'node:assert/strict';
import test from 'node:test';

import grpcCredentials from '../../src/lnd_grpc/grpc_credentials.js';

const tests = [
  {
    args: {macaroon: '00'},
    description: 'gRPC credentials are returned',
  },
  {
    args: {},
    description: 'gRPC credentials without a macaroon are returned',
  },
  {
    args: {macaroon: '='},
    description: 'A macaroon that does not decode is rejected',
    error: 'ExpectedBase64OrHexEncodedMacaroonToCreateCredentials',
  },
];

tests.forEach(({args, description, error}) => {
  return test(description, () => {
    if (!!error) {
      throws(() => grpcCredentials(args), new Error(error), 'Got error');
    } else {
      equal(!!grpcCredentials(args).credentials, true, 'Got credentials');
    }

    return;
  });
});
