import grpc from '@grpc/grpc-js';

import decodeSerialized from './decode_serialized.js';
import grpcSsl from './grpc_ssl.js';

const {combineChannelCredentials} = grpc.credentials;
const {createFromMetadataGenerator} = grpc.credentials;
const {Metadata} = grpc;

const generate = (macaroon: Buffer) => {
  const metadata = new Metadata();

  metadata.add('macaroon', macaroon.toString('hex'));

  return metadata;
};

/** Credentials for gRPC

  {
    [cert]: <Base64 or Hex Serialized lnd TLS Cert String>
    [macaroon]: <Base64 or Hex Serialized Macaroon String>
  }

  @throws
  <Error>

  @returns
  {
    credentials: <gRPC Credentials Object>
  }
*/
export default ({cert, macaroon}: {cert?: string; macaroon?: string}) => {
  if (!macaroon) {
    return {credentials: grpcSsl({cert}).ssl};
  }

  const mac = decodeSerialized({serialized: macaroon}).decoded;

  if (!mac?.length) {
    throw new Error('ExpectedBase64OrHexEncodedMacaroonToCreateCredentials');
  }

  const creds = createFromMetadataGenerator((_, c) => c(null, generate(mac)));
  const {ssl} = grpcSsl({cert});

  return {credentials: combineChannelCredentials(ssl, creds)};
};
