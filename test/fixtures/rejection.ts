/** Get the rejection of a promise, or throw if the promise resolves */
export const rejection = async (
  promise: Promise<unknown>,
): Promise<unknown> => {
  try {
    await promise;
  } catch (err) {
    return err;
  }

  throw new Error('ExpectedPromiseToReject');
};
