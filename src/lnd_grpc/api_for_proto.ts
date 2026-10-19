import grpc from '@grpc/grpc-js';
import type {ChannelCredentials} from '@grpc/grpc-js';
import type {ChannelOptions} from '@grpc/grpc-js';
import type {Client} from '@grpc/grpc-js';
import type {ServiceClientConstructor} from '@grpc/grpc-js';
import type {ServiceDefinition} from '@grpc/grpc-js';
import {loadSync} from '@grpc/proto-loader';

import grpcOptions from './grpc_options.js';

// Loading a proto file is slow, so keep each loaded file
const loaded = new Map<string, any>();

type Args = {
  credentials: ChannelCredentials;
  includes: string[];
  params: ChannelOptions;
  path: string;
  service: string;
  socket: string;
  type: string;
};

/** Get a gRPC client for a service in a proto file

  {
    credentials: <gRPC Credentials Object>
    includes: [<Proto Import Directory Path String>]
    params: <gRPC Channel Options Object>
    path: <Proto File Path String>
    service: <Service Name String>
    socket: <Host:Port Network Address String>
    type: <RPC Type String>
  }

  @returns
  {
    client: <gRPC Service Client Object>
    definition: <gRPC Service Definition Object>
  }
*/
export default (
  args: Args,
): {client: Client; definition: ServiceDefinition} => {
  const key = JSON.stringify([args.path, args.includes]);
  const options = {...grpcOptions, includeDirs: args.includes};

  if (!loaded.has(key)) {
    loaded.set(key, grpc.loadPackageDefinition(loadSync(args.path, options)));
  }

  const rpc = loaded.get(key);

  const Service: ServiceClientConstructor = rpc[args.type][args.service];

  return {
    client: new Service(args.socket, args.credentials, args.params),
    definition: Service.service,
  };
};
