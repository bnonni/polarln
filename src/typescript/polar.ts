/** Polar HTTP Bridge Object */
export type Polar = {
  /** Fetch Function */
  fetch: typeof fetch;
  /** Bridge Base URL Without a Trailing Slash */
  url: string;
};

/** Polar Docker Backend Object (the backend does not use the Polar app) */
export type PolarDocker = {
  /** Data Directory Path */
  dataDir: string;
  /** Run One Polar Tool With Its Arguments */
  execute: (tool: string, args: object) => Promise<unknown>;
};

/** Polar Backend: the Polar Bridge or the Docker Backend */
export type PolarBackend = Polar | PolarDocker;

/** Method Arguments With the Polar Backend Object */
export type PolarArgs<T extends object> = T & {
  /** Polar Backend Object */
  polar: PolarBackend;
};

/** Rejection: [Code Number, Message String, Details Object] */
export type PolarError =
  | [number, string]
  | [number, string, {[key: string]: unknown}];
