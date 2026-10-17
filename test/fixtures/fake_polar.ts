import type {Polar} from '../../src/index.js';

export type FakeRequest = {body?: unknown; method?: string; url: string};

type FakePolarArgs = {
  /** Response Body (a string is sent as is, other values as JSON) */
  body?: unknown;
  /** Error to Throw From fetch */
  error?: Error;
  /** Response for Each Request (replaces body and status) */
  respond?: (request: FakeRequest) => {body?: unknown; status?: number};
  /** Response Status (default: 200) */
  status?: number;
};

/** Get a Polar bridge object with a fake fetch that records each request */
export const fakePolar = (args: FakePolarArgs = {}) => {
  const requests: FakeRequest[] = [];

  const fetch = async (url: string, init?: RequestInit) => {
    const body =
      typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;

    const request = {body, method: init?.method, url};

    requests.push(request);

    if (!!args.error) {
      throw args.error;
    }

    const response = args.respond?.(request) ?? args;

    const text =
      typeof response.body === 'string'
        ? response.body
        : JSON.stringify(response.body ?? {});

    return new Response(text, {status: response.status ?? 200});
  };

  const polar: Polar = {
    fetch: fetch as unknown as typeof globalThis.fetch,
    url: 'http://polar',
  };

  return {polar, requests};
};
