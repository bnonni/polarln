/** gRPC methods of one lnd service

  A unary method returns a Promise for the response.
  A streaming method returns the gRPC call stream.
*/
export type LndService = {[method: string]: (request?: object) => any};

/** Authenticated lnd gRPC API Object */
export type AuthenticatedLnd = {
  /** Lightning Methods */
  lightning: LndService;
  /** Router Methods */
  router: LndService;
  /** State Methods (no macaroon needed) */
  state: LndService;
};

export type LndServiceType = keyof AuthenticatedLnd;

export type LndAuthentication = {
  /** Base64 or Hex Serialized lnd TLS Cert String */
  cert?: string;
  /** Base64 or Hex Serialized Macaroon String */
  macaroon?: string;
  /** Path to Protos Directory With the lnrpc Directory String */
  path?: string;
  /** Host:Port Network Address String */
  socket?: string;
};
