/** Polar HTTP Bridge Object */
export type Polar = {
  /** Fetch Function */
  fetch: typeof fetch;
  /** Bridge Base URL Without a Trailing Slash */
  url: string;
};

/** Method Arguments With the Polar Bridge Object */
export type PolarArgs<T extends object> = T & {
  /** Polar Bridge Object */
  polar: Polar;
};

/** Rejection: [Code Number, Message String, Details Object] */
export type PolarError =
  | [number, string]
  | [number, string, {[key: string]: unknown}];
