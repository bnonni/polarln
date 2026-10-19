import {readFile} from 'node:fs/promises';

import {authenticatedLndGrpc} from '../lnd_grpc/index.js';
import type {AuthenticatedLnd} from '../lnd_grpc/index.js';
import type {LndNode} from '../typescript/index.js';

/** Get an lnd gRPC client for the host port of an LND node

  Close the client after use

  Use localhost, not 127.0.0.1: the lnd TLS cert names localhost, and Node
  warns if the TLS server name is an IP address

  {
    [noMacaroon]: <Use Only the TLS Cert, for the State Methods Bool>
    node: <LND Node Object>
  }

  @throws
  <Error>

  @returns via Promise
  {
    close: <Close the gRPC Clients Function>
    lnd: <Authenticated LND gRPC API Object>
  }
*/
export default async (args: {
  noMacaroon?: boolean;
  node: LndNode;
}): Promise<{close: () => void; lnd: AuthenticatedLnd}> => {
  const {paths, ports} = args.node;

  const cert = (await readFile(paths.tlsCert)).toString('hex');

  const macaroon = !!args.noMacaroon
    ? undefined
    : (await readFile(paths.adminMacaroon)).toString('hex');

  return authenticatedLndGrpc({
    cert,
    macaroon,
    socket: `localhost:${ports.grpc}`,
  });
};
