import type {Polar} from '../../src/index.js';

export type FakeRequest = {body?: unknown; method?: string; url: string};

type FakePolarArgs = {
  /** Response Body (a string is sent as is, other values as JSON) */
  body?: unknown;
  /** Error to Throw From fetch */
  error?: Error;
  /** Response Status (default: 200) */
  status?: number;
};

/** Get a Polar bridge object with a fake fetch that records each request */
export const fakePolar = (args: FakePolarArgs = {}) => {
  const requests: FakeRequest[] = [];

  const fetch = async (url: string, init?: RequestInit) => {
    const body =
      typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;

    requests.push({body, method: init?.method, url});

    if (!!args.error) {
      throw args.error;
    }

    const text =
      typeof args.body === 'string'
        ? args.body
        : JSON.stringify(args.body ?? {});

    return new Response(text, {status: args.status ?? 200});
  };

  const polar: Polar = {
    fetch: fetch as unknown as typeof globalThis.fetch,
    url: 'http://polar',
  };

  return {polar, requests};
};
