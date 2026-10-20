import type {Client} from '@grpc/grpc-js';
import type {ClientDuplexStream} from '@grpc/grpc-js';
import type {ClientReadableStream} from '@grpc/grpc-js';
import type {ServiceDefinition} from '@grpc/grpc-js';
import type {ServiceError} from '@grpc/grpc-js';

import type {LndService} from './types.js';

/** gRPC Call Stream of a Streaming Method */
export type StreamCall =
  | ClientDuplexStream<unknown, unknown>
  | ClientReadableStream<unknown>;

type Args = {
  client: Client;
  definition: ServiceDefinition;
  /** Open Stream Calls */
  streams?: Set<StreamCall>;
};

/** Cancel the stream calls that are still open

  grpc-js Client.close() does not end the active calls, and an active call
  keeps the process alive

  <Open Stream Calls Set>
*/
export const cancelStreams = (streams: Set<StreamCall>) => {
  streams.forEach(call => {
    // The cancel of an active call emits a CANCELLED error
    call.on('error', () => {});

    call.cancel();
  });

  streams.clear();
};

/** Get the camelCase methods of a gRPC service client

  A unary method returns a Promise for the response.
  A streaming method returns the gRPC call stream.

  The streams set gets each stream call until the call ends

  {
    client: <gRPC Service Client Object>
    definition: <gRPC Service Definition Object>
    [streams]: <Open Stream Calls Set>
  }

  @returns
  <LND Service Methods Object>
*/
export default ({client, definition, streams}: Args): LndService => {
  const rpc = client as Client & {[name: string]: (...args: any[]) => any};

  // Keep a stream call in the set until the call ends
  const track = (call: StreamCall) => {
    if (!!streams) {
      streams.add(call);

      call.once('status', () => streams.delete(call));
    }

    return call;
  };

  return Object.entries(definition).reduce((methods, [name, method]) => {
    const key = method.originalName || name;

    // A request stream method gets its requests from the call stream
    if (method.requestStream) {
      methods[key] = () => track(rpc[name]());

      return methods;
    }

    if (method.responseStream) {
      methods[key] = (request = {}) => track(rpc[name](request));

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
