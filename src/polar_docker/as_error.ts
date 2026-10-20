// Error objects have no enumerable properties, so use their messages. JSON
// cannot show a bigint, so use its text.
const replacer = (_key: string, value: unknown) => {
  if (value instanceof Error) {
    return value.message;
  }

  return typeof value === 'bigint' ? value.toString() : value;
};

// Get the JSON text of a value, or undefined if JSON cannot show the value
const jsonOf = (value: unknown) => {
  try {
    return JSON.stringify(value, replacer);
  } catch {
    return undefined;
  }
};

// Get the text of a value: a string stays the same
const textOf = (value: unknown) =>
  typeof value === 'string' ? value : jsonOf(value) || String(value);

/** Get the Error object of a failure, for the error message of a node

  A PolarError tuple gives its message and its details as one text, for
  example: NetworksFileBusy: {"dataDir":"/data"}. An Error object in the
  details gives its message. If JSON cannot show the details, the text is
  only the message. An Error object stays the same.

  <Failure>

  @returns
  <Error Object>
*/
export default (err: unknown): Error => {
  if (err instanceof Error) {
    return err;
  }

  if (!Array.isArray(err)) {
    return new Error(textOf(err));
  }

  const [, message, details] = err as unknown[];

  const detailsText = details === undefined ? undefined : jsonOf(details);

  if (!detailsText) {
    return new Error(textOf(message));
  }

  return new Error(`${textOf(message)}: ${detailsText}`);
};
