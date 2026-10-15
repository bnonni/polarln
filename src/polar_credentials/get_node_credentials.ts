import {readFile} from 'node:fs/promises';

import {listNetworks} from '../polar_methods/index.js';
import type {Polar} from '../typescript/index.js';
import type {PolarError} from '../typescript/index.js';
import type {LitdNode} from '../typescript/index.js';
import type {LndNode} from '../typescript/index.js';
import type {PolarNode} from '../typescript/index.js';
import type {TapdNode} from '../typescript/index.js';

// Use localhost, not 127.0.0.1: the Polar TLS certs name localhost
const host = 'localhost';
const isNetworkId = (n: unknown) => Number.isSafeInteger(n);
const isNodeName = (n: unknown) => typeof n === 'string' && !!n;
const isSupported = (n: PolarNode): n is SupportedNode =>
  supported.includes(n.implementation);
const supported: PolarNode['implementation'][] = ['LND', 'litd', 'tapd'];

type Daemon = 'litd' | 'lnd' | 'tapd';
type FileSpec = {cert: string; macaroon: string; port: number};
type SupportedNode = LitdNode | LndNode | TapdNode;

export type GrpcCredentials = {
  /** Base64 TLS Certificate File */
  cert: string;
  /** Base64 Macaroon File */
  macaroon: string;
  /** gRPC Socket (host:port) */
  socket: string;
};

export type GetNodeCredentialsArgs = {
  networkId: number;
  nodeName: string;
  polar: Polar;
};

export type GetNodeCredentialsResult = {
  implementation: 'LND' | 'litd' | 'tapd';
  /** litd Credentials (litd nodes) */
  litd?: GrpcCredentials;
  /** lnd Credentials With the Admin Macaroon (LND and litd nodes) */
  lnd?: GrpcCredentials;
  /** tapd Credentials (tapd and litd nodes) */
  tapd?: GrpcCredentials;
};

// Get the file paths and port of each daemon in a node
const fileSpecs = (node: SupportedNode): {[daemon in Daemon]?: FileSpec} => {
  if (node.implementation === 'tapd') {
    return {
      tapd: {
        cert: node.paths.tlsCert,
        macaroon: node.paths.adminMacaroon,
        port: node.ports.grpc,
      },
    };
  }

  const lnd = {
    cert: node.paths.tlsCert,
    macaroon: node.paths.adminMacaroon,
    port: node.ports.grpc,
  };

  if (node.implementation === 'LND') {
    return {lnd};
  }

  // In litd integrated mode, the litd port also serves tapd
  return {
    litd: {
      cert: node.paths.litTlsCert,
      macaroon: node.paths.litMacaroon,
      port: node.ports.web,
    },
    lnd,
    tapd: {
      cert: node.paths.litTlsCert,
      macaroon: node.paths.tapMacaroon,
      port: node.ports.web,
    },
  };
};

// Read a file as base64
const readBase64 = async (path: string) => {
  try {
    return (await readFile(path)).toString('base64');
  } catch (err) {
    throw [503, 'FailedToReadNodeCredentialFile', {err, path}];
  }
};

// Read the cert and macaroon of a daemon
const credentials = async ([daemon, spec]: [string, FileSpec]) => {
  const [cert, macaroon] = await Promise.all([
    readBase64(spec.cert),
    readBase64(spec.macaroon),
  ]);

  return [daemon, {cert, macaroon, socket: `${host}:${spec.port}`}] as const;
};

/** Get the gRPC credentials of a Polar node

  The result goes into the authenticated gRPC constructors of `lightning`
  (`authenticatedLndGrpc`), `tapass` (`authenticatedTapdGrpc`), and
  `litterm` (`authenticatedLitdGrpc`)

  LND nodes give `lnd`, tapd nodes give `tapd`, and litd nodes give all three

  The node must be started

  {
    networkId: <Network Id Number>
    nodeName: <Node Name String>
    polar: <Polar Bridge Object>
  }

  @returns via Promise
  {
    implementation: <Node Implementation String>
    [litd]: {
      cert: <Base64 TLS Certificate String>
      macaroon: <Base64 Macaroon String>
      socket: <Host:Port String>
    }
    [lnd]: <Same Shape as litd>
    [tapd]: <Same Shape as litd>
  }

  @rejects <PolarError>
*/
export default async (
  args: GetNodeCredentialsArgs,
): Promise<GetNodeCredentialsResult> => {
  if (!isNetworkId(args.networkId)) {
    throw [400, 'ExpectedNetworkIdToGetNodeCredentials'] satisfies PolarError;
  }

  if (!isNodeName(args.nodeName)) {
    throw [400, 'ExpectedNodeNameToGetNodeCredentials'] satisfies PolarError;
  }

  const {networks} = await listNetworks({polar: args.polar});

  const network = networks.find(({id}) => id === args.networkId);

  if (!network) {
    throw [404, 'PolarNetworkNotFound', {networkId: args.networkId}];
  }

  const {bitcoin, lightning, tap} = network.nodes;

  const node = [...bitcoin, ...lightning, ...tap].find(({name}) => {
    return name === args.nodeName;
  });

  if (!node) {
    throw [404, 'PolarNodeNotFound', {nodeName: args.nodeName}];
  }

  if (!isSupported(node)) {
    const {implementation} = node;

    throw [
      400,
      'UnsupportedImplementationToGetNodeCredentials',
      {implementation},
    ];
  }

  if (node.status !== 'Started') {
    throw [
      503,
      'ExpectedStartedNodeToGetNodeCredentials',
      {status: node.status},
    ];
  }

  const specs = Object.entries(fileSpecs(node));

  const entries = await Promise.all(specs.map(credentials));

  const daemons: {[daemon in Daemon]?: GrpcCredentials} =
    Object.fromEntries(entries);

  return {implementation: node.implementation, ...daemons};
};
