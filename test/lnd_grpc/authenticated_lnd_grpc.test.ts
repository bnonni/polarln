import {deepStrictEqual} from 'node:assert/strict';
import {equal} from 'node:assert/strict';
import {createServer} from 'node:net';
import type {Socket} from 'node:net';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

import grpc from '@grpc/grpc-js';

import {authenticatedLndGrpc} from '../../src/lnd_grpc/index.js';

const protosPath = fileURLToPath(new URL('../../protos/', import.meta.url));

// Polar uses these methods
const expectedMethods = {
  lightning: [
    'addInvoice',
    'channelBalance',
    'closeChannel',
    'connectPeer',
    'decodePayReq',
    'getChanInfo',
    'getInfo',
    'listChannels',
    'listPeers',
    'newAddress',
    'openChannelSync',
    'pendingChannels',
    'subscribeChannelEvents',
    'walletBalance',
  ],
  router: ['sendPaymentV2'],
  state: ['getState'],
};

const tests = [
  {
    args: {macaroon: Buffer.alloc(1).toString('hex')},
    description: 'An authenticated lnd gRPC Object is returned',
  },
  {
    args: {cert: '00', macaroon: Buffer.alloc(1).toString('hex')},
    description: 'Passing a cert for the authenticated lnd gRPC is supported',
  },
  {
    args: {},
    description: 'No macaroon is needed for the State methods',
  },
  {
    args: {path: protosPath, socket: 'localhost:10001'},
    description: 'The path and socket can be specified',
  },
];

tests.forEach(({args, description}) => {
  return test(description, () => {
    const {close, lnd} = authenticatedLndGrpc(args);

    deepStrictEqual(
      Object.keys(lnd).sort(),
      Object.keys(expectedMethods).sort(),
      'Got services',
    );

    Object.entries(expectedMethods).forEach(([type, methods]) => {
      const service = lnd[type as keyof typeof lnd];

      methods.forEach(method => {
        equal(typeof service[method], 'function', `Got ${type}.${method}`);
      });
    });

    close();

    return;
  });
});

test('close cancels the open stream calls', async () => {
  const sockets: Socket[] = [];

  // The server takes the connection and never answers the TLS handshake
  const server = createServer(socket => sockets.push(socket));

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));

  const {port} = server.address() as {port: number};

  const {close, lnd} = authenticatedLndGrpc({socket: `localhost:${port}`});

  // A server stream call and a request stream call
  const calls = [
    lnd.lightning.closeChannel({}),
    lnd.lightning.channelAcceptor(),
  ];

  const statuses = calls.map(call => {
    call.on('error', () => {});

    return new Promise<any>(resolve => call.once('status', resolve));
  });

  try {
    await new Promise(resolve => setTimeout(resolve, 300));

    close();

    const codes = (await Promise.all(statuses)).map(({code}) => code);

    // Without the cancel, the channel shutdown gives UNAVAILABLE
    deepStrictEqual(codes, [grpc.status.CANCELLED, grpc.status.CANCELLED]);
  } finally {
    sockets.forEach(socket => socket.destroy());
    server.close();
  }
});
