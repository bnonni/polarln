import {deepStrictEqual} from 'node:assert/strict';
import {equal} from 'node:assert/strict';
import {rejects} from 'node:assert/strict';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

import grpc from '@grpc/grpc-js';
import {loadSync} from '@grpc/proto-loader';

import apiForProto from '../../src/lnd_grpc/api_for_proto.js';
import grpcOptions from '../../src/lnd_grpc/grpc_options.js';
import promiseService from '../../src/lnd_grpc/promise_service.js';
import {cancelStreams} from '../../src/lnd_grpc/promise_service.js';
import type {StreamCall} from '../../src/lnd_grpc/promise_service.js';

const protosPath = fileURLToPath(new URL('../../protos/', import.meta.url));

const includes = [join(protosPath, 'lnrpc')];
const lightningPath = join(protosPath, 'lnrpc/lightning.proto');
const routerPath = join(protosPath, 'lnrpc/routerrpc/router.proto');

const load = (path: string) => {
  const options = {...grpcOptions, includeDirs: includes};

  return grpc.loadPackageDefinition(loadSync(path, options)) as any;
};

// Serve fake lnd methods on a free local port
const startServer = async () => {
  const server = new grpc.Server();

  // The fake close stream sends 1 update and ends only on a cancel
  let cancelled: () => void = () => {};

  const closeCancelled = new Promise<void>(resolve => (cancelled = resolve));

  server.addService(load(lightningPath).lnrpc.Lightning.service, {
    closeChannel: (call: any) => {
      call.on('cancelled', () => cancelled());

      return call.write({
        closePending: {outputIndex: 0, txid: Buffer.from('')},
      });
    },
    getChanInfo: ({request}: any, cbk: any) => {
      return cbk(null, {capacity: '250000', channelId: request.chanId});
    },
    getInfo: (_: any, cbk: any) => {
      return cbk(null, {blockHeight: 101, identityPubkey: 'pubkey'});
    },
    listPeers: (_: any, cbk: any) => {
      return cbk({code: grpc.status.UNAVAILABLE, details: 'NodeIsDown'});
    },
    subscribeChannelEvents: (call: any) => {
      call.write({fullyResolvedChannel: {}, type: 'FULLY_RESOLVED_CHANNEL'});

      return call.end();
    },
  });

  server.addService(load(routerPath).routerrpc.Router.service, {
    sendPaymentV2: (call: any) => {
      call.write({status: 'SUCCEEDED', valueSat: call.request.amt});

      return call.end();
    },
  });

  const port = await new Promise<number>((resolve, reject) => {
    server.bindAsync(
      '127.0.0.1:0',
      grpc.ServerCredentials.createInsecure(),
      (err, port) => (!!err ? reject(err) : resolve(port)),
    );
  });

  return {closeCancelled, port, server};
};

const service = (args: {
  path: string;
  service: string;
  socket: string;
  streams?: Set<StreamCall>;
}) => {
  const api = apiForProto({
    includes,
    credentials: grpc.credentials.createInsecure(),
    params: {},
    path: args.path,
    service: args.service,
    socket: args.socket,
    type: args.service === 'Lightning' ? 'lnrpc' : 'routerrpc',
  });

  const methods = promiseService({...api, streams: args.streams});

  return {client: api.client, methods};
};

const firstData = (stream: any) => {
  return new Promise((resolve, reject) => {
    stream.once('data', resolve);
    stream.once('error', reject);
  });
};

test('Promise service methods call lnd methods', async () => {
  const {port, server} = await startServer();
  const socket = `127.0.0.1:${port}`;

  const lightning = service({
    path: lightningPath,
    service: 'Lightning',
    socket,
  });
  const router = service({path: routerPath, service: 'Router', socket});

  try {
    const info = await lightning.methods.getInfo();

    equal(info.blockHeight, 101, 'Got a camelCase number field');
    equal(info.identityPubkey, 'pubkey', 'Got a camelCase string field');
    equal(info.syncedToChain, false, 'Got a default boolean field');
    deepStrictEqual(info.chains, [], 'Got a default list field');

    const chan = await lightning.methods.getChanInfo({chanId: '123'});

    equal(chan.capacity, '250000', 'Got an int64 as a string');
    equal(chan.channelId, '123', 'Got a uint64 request field as a string');

    await rejects(
      lightning.methods.listPeers(),
      (err: any) => err.code === grpc.status.UNAVAILABLE,
      'Got a unary error',
    );

    const event: any = await firstData(
      lightning.methods.subscribeChannelEvents(),
    );

    equal(event.type, 'FULLY_RESOLVED_CHANNEL', 'Got an enum as a string');
    equal(event.channel, 'fullyResolvedChannel', 'Got the oneof field name');

    const payment: any = await firstData(
      router.methods.sendPaymentV2({amt: '10000'}),
    );

    equal(payment.status, 'SUCCEEDED', 'Got a payment status');
    equal(payment.valueSat, '10000', 'Got a payment value');

    const acceptor = lightning.methods.channelAcceptor();

    // The fake server does not serve the method, so the call ends in error
    acceptor.on('error', () => {});

    equal(
      typeof acceptor.write,
      'function',
      'A request stream method returns a writable call',
    );

    acceptor.cancel();
  } finally {
    lightning.client.close();
    router.client.close();
    server.forceShutdown();
  }

  return;
});

test('cancelStreams cancels the open stream calls', async () => {
  const {closeCancelled, port, server} = await startServer();
  const socket = `127.0.0.1:${port}`;
  const streams = new Set<StreamCall>();

  const lightning = service({
    path: lightningPath,
    service: 'Lightning',
    socket,
    streams,
  });

  try {
    const ended = lightning.methods.subscribeChannelEvents();

    await firstData(ended);
    await new Promise(resolve => ended.once('status', resolve));

    equal(streams.size, 0, 'A stream call that ends leaves the set');

    // The close stream has no error listener, so a CANCELLED error would throw
    const open = lightning.methods.closeChannel({});

    await new Promise(resolve => open.once('data', resolve));

    equal(streams.size, 1, 'An open stream call is in the set');

    const status = new Promise<any>(resolve => open.once('status', resolve));

    cancelStreams(streams);

    await closeCancelled;

    equal((await status).code, grpc.status.CANCELLED, 'The call ended');
    equal(streams.size, 0, 'The set is empty');
  } finally {
    lightning.client.close();
    server.forceShutdown();
  }

  return;
});
