import type {Polar} from '../typescript/index.js';

const defaultPort = 37373;
const trailingSlashes = /\/+$/;

export type PolarBridgeArgs = {
  /** Fetch Function (default: global fetch) */
  fetch?: typeof fetch;
  /** Bridge Base URL (default: http://localhost:$POLAR_MCP_PORT or 37373) */
  url?: string;
};

/** Get a Polar HTTP bridge object

  The Polar v4 desktop app serves the bridge while it runs

  Polar reads the bridge port from the POLAR_MCP_PORT environment variable

  {
    [fetch]: <Fetch Function>
    [url]: <Bridge Base URL String>
  }

  @returns
  {
    polar: <Polar Bridge Object>
  }
*/
export default (args: PolarBridgeArgs = {}): {polar: Polar} => {
  const port = process.env.POLAR_MCP_PORT || defaultPort;

  const url = args.url || `http://localhost:${port}`;

  return {
    polar: {
      fetch: args.fetch || globalThis.fetch,
      url: url.replace(trailingSlashes, ''),
    },
  };
};
