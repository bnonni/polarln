/** Answer of a JSON Request */
export type JsonAnswer = {
  /** Body JSON (undefined: the body is not JSON) */
  json: unknown;
  /** The Status Is 2xx */
  ok: boolean;
  /** HTTP Status Code */
  status: number;
};

/** Arguments of a JSON Request */
export type FetchJsonArgs = {
  /** Fetch Function */
  fetch: typeof fetch;
  /** Request Options */
  init: RequestInit;
  /** Maximum Milliseconds for the Request and the Body (default: no limit) */
  timeout?: number;
  /** URL String */
  url: string;
};

// Send the request and read the body. A body that is not JSON gives undefined.
const read = async (args: {
  fetch: typeof fetch;
  init: RequestInit;
  url: string;
}): Promise<JsonAnswer> => {
  const res = await args.fetch(args.url, args.init);

  const json = (await res.json().catch(() => {
    const {signal} = args.init;

    // An abort of the body read is a timeout, not a body that is not JSON
    if (!!signal?.aborted) {
      throw signal.reason;
    }

    return undefined;
  })) as unknown;

  return {json, ok: res.ok, status: res.status};
};

/** Send a request and read the JSON body

  The timeout covers the connect, the headers, and the body. A timeout
  rejects with a TimeoutError, also if fetch ignores the signal. A failure to
  connect rejects with the fetch error. A body that is not JSON gives no
  rejection: the json value is undefined.

  With no timeout, the request has no signal and no limit.

  {
    fetch: <Fetch Function>
    init: <Request Options Object>
    [timeout]: <Maximum Milliseconds Number> // Default: no limit
    url: <URL String>
  }

  @rejects
  <Error>

  @returns via Promise
  {
    json: <Body JSON Object> // undefined if the body is not JSON
    ok: <The Status Is 2xx Bool>
    status: <HTTP Status Code Number>
  }
*/
export default async (args: FetchJsonArgs): Promise<JsonAnswer> => {
  if (args.timeout === undefined) {
    return read({fetch: args.fetch, init: args.init, url: args.url});
  }

  const signal = AbortSignal.timeout(args.timeout);

  // The read is async, so a fetch that throws at once gives a rejection. The
  // race handles it, and also the later rejection of the timeout promise.
  const answer = read({
    fetch: args.fetch,
    init: {...args.init, signal},
    url: args.url,
  });

  // A fetch can ignore the signal, so the timeout also ends the wait
  const timedOut = new Promise<never>((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), {
      once: true,
    });
  });

  return Promise.race([answer, timedOut]);
};
