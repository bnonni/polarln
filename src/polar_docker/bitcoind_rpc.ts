import type {BitcoinNode} from '../typescript/index.js';
import {bitcoinCredentials} from './docker_configs.js';

const {pass, user} = bitcoinCredentials;

// Polar gives each RPC call 5 minutes, for example to mine many blocks
const timeoutMs = 5 * 60 * 1000;

const authorization = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;

type Response<T> = {error?: {code: number; message: string} | null; result: T};

/** Call a bitcoind JSON-RPC method on the host port of a node

  {
    method: <RPC Method Name String>
    node: <bitcoind Node Object>
    [params]: [<RPC Parameter Value>]
  }

  @throws
  <Error>

  @returns via Promise
  <RPC Result Value>
*/
export default async <T>(args: {
  method: string;
  node: BitcoinNode;
  params?: unknown[];
}): Promise<T> => {
  const res = await fetch(`http://127.0.0.1:${args.node.ports.rpc}/`, {
    body: JSON.stringify({
      id: args.method,
      jsonrpc: '1.0',
      method: args.method,
      params: args.params || [],
    }),
    headers: {authorization, 'content-type': 'application/json'},
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await res.text();

  let body: Response<T>;

  try {
    body = JSON.parse(text) as Response<T>;
  } catch {
    throw new Error(
      `bitcoind ${args.method} failed: HTTP ${res.status} ${text}`.trim(),
    );
  }

  if (!!body.error) {
    throw new Error(body.error.message);
  }

  return body.result;
};
