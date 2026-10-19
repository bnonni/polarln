import type {Client} from '@grpc/grpc-js';
import type {ServiceDefinition} from '@grpc/grpc-js';
import type {ServiceError} from '@grpc/grpc-js';

import type {LndService} from './types.js';

type Args = {
  client: Client;
  definition: ServiceDefinition;
};

/** Get the camelCase methods of a gRPC service client

  A unary method returns a Promise for the response.
  A streaming method returns the gRPC call stream.

  {
    client: <gRPC Service Client Object>
    definition: <gRPC Service Definition Object>
  }

  @returns
  <LND Service Methods Object>
*/
export default ({client, definition}: Args): LndService => {
  const rpc = client as Client & {[name: string]: (...args: any[]) => any};

  return Object.entries(definition).reduce((methods, [name, method]) => {
    const key = method.originalName || name;

    // A request stream method gets its requests from the call stream
    if (method.requestStream) {
      methods[key] = () => rpc[name]();

      return methods;
    }

    if (method.responseStream) {
      methods[key] = (request = {}) => rpc[name](request);

      return methods;
    }

    methods[key] = (request = {}) => {
      return new Promise((resolve, reject) => {
        rpc[name](request, (err: ServiceError | null, res: unknown) => {
          return !!err ? reject(err) : resolve(res);
        });
      });
    };

    return methods;
  }, {} as LndService);
};
