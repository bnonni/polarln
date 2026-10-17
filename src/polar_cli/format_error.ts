// Error objects have no enumerable properties, so copy the useful ones
const replacer = (_key: string, value: unknown) => {
  if (!(value instanceof Error)) {
    return value;
  }

  const {code, errors} = value as Error & {code?: unknown; errors?: unknown};

  return {cause: value.cause, code, errors, message: value.message};
};

/** Get the error output line of a rejection

  <Rejection>

  @returns
  <JSON Line String>
*/
export default (err: unknown) => `${JSON.stringify(err, replacer)}\n`;
