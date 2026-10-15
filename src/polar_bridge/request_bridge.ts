import type {Polar} from '../typescript/index.js';
import type {PolarError} from '../typescript/index.js';
import errorFromPolar from './error_from_polar.js';

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
  /** Tool Name String */
  tool?: string;
};

/** Send a request to the Polar bridge

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

  let res: Response;

  try {
    res = await args.polar.fetch(`${args.polar.url}${args.path}`, init);
  } catch (err) {
    throw [503, 'FailedToConnectToPolarBridge', {...details, err}];
  }

  const json = await res.json().catch(() => undefined);

  if (res.ok && json !== undefined) {
    return json;
  }

  const err = errorOf(json);

  if (res.status === polarToolFailedStatus && typeof err === 'string') {
    throw errorFromPolar({err, tool: args.tool || ''});
  }

  throw [
    503,
    'UnexpectedPolarBridgeResponse',
    {...details, err, status: res.status},
  ] satisfies PolarError;
};
