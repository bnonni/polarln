import grpc from '@grpc/grpc-js';

import decodeSerialized from './decode_serialized.js';

const {createSsl} = grpc.credentials;

/** Get SSL for gRPC

  {
    [cert]: <Cert Hex or Base64 String>
  }

  @returns
  {
    ssl: <SSL gRPC Object>
  }
*/
export default ({cert}: {cert?: string}) => {
  return {ssl: createSsl(decodeSerialized({serialized: cert}).decoded)};
};
