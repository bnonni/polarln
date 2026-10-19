import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

import apiForProto from './api_for_proto.js';
import grpcCredentials from './grpc_credentials.js';
import grpcServices from './grpc_services.js';
import promiseService from './promise_service.js';
import type {AuthenticatedLnd} from './types.js';
import type {LndAuthentication} from './types.js';
import type {LndServiceType} from './types.js';

const {defaultSocket} = grpcServices;
const {includeDirs} = grpcServices;
const {keepaliveTimeMs} = grpcServices;
const {keepaliveTimeoutMs} = grpcServices;
const {keys} = Object;
const {packageTypes} = grpcServices;
const {protoFiles} = grpcServices;
const {protosDir} = grpcServices;
const {serviceTypes} = grpcServices;

const defaultProtosPath = fileURLToPath(new URL(protosDir, import.meta.url));

/** Initiate a gRPC API Methods Object for authenticated lnd methods

  Both the cert and macaroon expect the entire serialized lnd generated file

  The response fields are camelCase, as in the @lightningpolar packages

  The State methods work without a macaroon, before lnd makes the wallet

  {
    [cert]: <Base64 or Hex Serialized lnd TLS Cert String>
    [macaroon]: <Base64 or Hex Serialized Macaroon String>
    [path]: <Path to Protos Directory With the lnrpc Directory String>
    [socket]: <Host:Port Network Address String>
  }

  @throws
  <Error>

  @returns
  {
    close: <Close the gRPC Clients Function>
    lnd: {
      lightning: <Lightning API Methods Object>
      router: <Router API Methods Object>
      state: <State API Methods Object>
    }
  }
*/
export default (
  args: LndAuthentication,
): {close: () => void; lnd: AuthenticatedLnd} => {
  const {credentials} = grpcCredentials(args);
  const protosPath = args.path || defaultProtosPath;

  const includes = includeDirs.map(dir => join(protosPath, dir));

  const params = {
    'grpc.keepalive_time_ms': keepaliveTimeMs,
    'grpc.keepalive_timeout_ms': keepaliveTimeoutMs,
    'grpc.max_receive_message_length': -1,
    'grpc.max_send_message_length': -1,
  };

  // Assemble different services from their proto files
  const services = (keys(serviceTypes) as LndServiceType[]).map(type => {
    const service = serviceTypes[type];

    const api = apiForProto({
      credentials,
      includes,
      params,
      service,
      path: join(protosPath, protoFiles[service]),
      socket: args.socket || defaultSocket,
      type: packageTypes[service],
    });

    return {type, ...api};
  });

  return {
    close: () => services.forEach(({client}) => client.close()),
    lnd: services.reduce((lnd, {client, definition, type}) => {
      lnd[type] = promiseService({client, definition});

      return lnd;
    }, {} as AuthenticatedLnd),
  };
};
