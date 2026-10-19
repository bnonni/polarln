// Ported from jamaljsr/polar (MIT): src/utils/async.ts.

/** An Error That Stops the Wait at Once */
export class AbortWaitError extends Error {}

/** Wait for a time

  <Milliseconds Number>

  @returns via Promise
*/
export const delay = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms));

/** Run a check until it does not throw, or until the time ends

  {
    check: <Check Function That Rejects to Try Again>
    [interval]: <Milliseconds Between Checks Number>
    [timeout]: <Maximum Milliseconds Number>
  }

  @rejects
  <Last Check Error>

  @returns via Promise
  <Check Result Value>
*/
export const waitFor = async <T>(args: {
  check: () => Promise<T>;
  interval?: number;
  timeout?: number;
}): Promise<T> => {
  const interval = args.interval ?? 1000;
  const end = Date.now() + (args.timeout ?? 120_000);

  while (true) {
    try {
      return await args.check();
    } catch (err) {
      if (err instanceof AbortWaitError || Date.now() + interval > end) {
        throw err;
      }
    }

    await delay(interval);
  }
};
