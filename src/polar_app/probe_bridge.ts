// Bridge shapes from jamaljsr/polar (MIT): electron/mcpBridge.ts (GET /health).

import fetchJson from '../polar_bridge/fetch_json.js';
import isConnectionRefused from './is_connection_refused.js';

/** Result of the Polar Bridge Probe */
export type BridgeProbe =
  | {result: 'answers'}
  | {result: 'refused'}
  | {err: unknown; result: 'unknown'};

const bridgeService = 'polar-mcp-bridge';
const defaultTimeout = 1500;
const trailingSlashes = /\/+$/;

const isObject = (value: unknown): value is {[key: string]: unknown} =>
  !!value && typeof value === 'object';

/** Probe the Polar bridge

  The Polar app answers GET /health with the service polar-mcp-bridge. A
  refused connect shows that no program listens at the URL. Each other result
  is unknown: a timeout, a different answer, a bad URL, or a different connect
  error. A program that accepts the connect and does not answer can be the
  Polar app, so a timeout is not a refused connect.

  In bun, a host name that does not resolve also gives a refused connect. Thus
  use a URL with localhost or an IP address.

  {
    [fetch]: <Fetch Function> // Default: global fetch
    [timeout]: <Maximum Milliseconds Number> // Default: 1500
    url: <Bridge Base URL String>
  }

  @returns via Promise
  {
    [err]: <Error Object> // Only for an unknown result
    result: <Probe Result String> // answers, refused, or unknown
  }
*/
export default async (args: {
  fetch?: typeof fetch;
  timeout?: number;
  url: string;
}): Promise<BridgeProbe> => {
  const url = `${args.url.replace(trailingSlashes, '')}/health`;

  try {
    // The timeout also ends a fetch that ignores the signal
    const answer = await fetchJson({
      fetch: args.fetch || globalThis.fetch,
      init: {method: 'GET'},
      timeout: args.timeout ?? defaultTimeout,
      url,
    });

    if (answer.ok && isObject(answer.json)) {
      if (answer.json.service === bridgeService) {
        return {result: 'answers'};
      }
    }

    const err = new Error(
      `The answer of ${url} is not from the Polar bridge (HTTP ${answer.status})`,
    );

    return {err, result: 'unknown'};
  } catch (err) {
    if (isConnectionRefused(err)) {
      return {result: 'refused'};
    }

    return {err, result: 'unknown'};
  }
};
