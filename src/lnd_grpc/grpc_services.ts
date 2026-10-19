/** gRPC settings for lnd

  `includeDirs` and `protoFiles` paths are relative to `protosDir`.
  `protosDir` is relative to the `lnd_grpc` directory.
*/
export default {
  defaultSocket: 'localhost:10009',
  includeDirs: ['lnrpc'],
  keepaliveTimeMs: 60000,
  keepaliveTimeoutMs: 120000,
  packageTypes: {
    Lightning: 'lnrpc',
    Router: 'routerrpc',
    State: 'lnrpc',
  },
  protoFiles: {
    Lightning: 'lnrpc/lightning.proto',
    Router: 'lnrpc/routerrpc/router.proto',
    State: 'lnrpc/stateservice.proto',
  },
  protosDir: '../../protos/',
  serviceTypes: {
    lightning: 'Lightning',
    router: 'Router',
    state: 'State',
  },
} as const;
