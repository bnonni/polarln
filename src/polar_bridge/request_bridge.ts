import type {Polar} from '../typescript/index.js';
import type {PolarError} from '../typescript/index.js';
import errorFromPolar from './error_from_polar.js';
import fetchJson from './fetch_json.js';
import type {JsonAnswer} from './fetch_json.js';

const errorOf = (json: unknown) => (json as {error?: unknown})?.error;
const isPolar = (n: Partial<Polar> | undefined) =>
  !!n && typeof n.fetch === 'function' && typeof n.url === 'string';
const jsonHeaders = {'content-type': 'application/json'};
const polarToolFailedStatus = 500;

type RequestBridgeArgs = {
  /** POST Body Object (no body means GET) */
  body?: object;
  /** URL Path String */
  path: string;
  /** Polar Bridge Object */
  polar: Polar;
  /** Maximum Milliseconds for the Request (default: no limit) */
  timeout?: number;
  /** Tool Name String */
  tool?: string;
};

/** Send a request to the Polar bridge

  The timeout covers the connect, the headers, and the body. A request that
  does not get the full answer in time rejects with 503
  FailedToConnectToPolarBridge, with a TimeoutError as err. The timeout ends
  the wait, also if fetch ignores the signal.

  {
    [body]: <POST Body Object>
    path: <URL Path String>
    polar: <Polar Bridge Object>
    [timeout]: <Maximum Milliseconds Number>
    [tool]: <Tool Name String>
  }

  @returns via Promise
  <Response JSON Object>

  @rejects <PolarError>
*/
export default async (args: RequestBridgeArgs): Promise<unknown> => {
  const details = !args.tool ? {} : {tool: args.tool};

  if (!isPolar(args.polar)) {
    throw [400, 'ExpectedPolarBridge', details] satisfies PolarError;
  }

  const init: RequestInit = !args.body
    ? {method: 'GET'}
    : {body: JSON.stringify(args.body), headers: jsonHeaders, method: 'POST'};

  let answer: JsonAnswer;

  try {
    answer = await fetchJson({
      fetch: args.polar.fetch,
      init,
      timeout: args.timeout,
      url: `${args.polar.url}${args.path}`,
    });
  } catch (err) {
    throw [503, 'FailedToConnectToPolarBridge', {...details, err}];
  }

  if (answer.ok && answer.json !== undefined) {
    return answer.json;
  }

  const err = errorOf(answer.json);

  if (answer.status === polarToolFailedStatus && typeof err === 'string') {
    throw errorFromPolar({err, tool: args.tool || ''});
  }

  throw [
    503,
    'UnexpectedPolarBridgeResponse',
    {...details, err, status: answer.status},
  ] satisfies PolarError;
};
