// Error codes of a refused connect: bun and Node
const refusedCodes = ['ConnectionRefused', 'ECONNREFUSED'];

// The cause chain of a fetch error is short
const maxDepth = 3;

const isObject = (value: unknown): value is {[key: string]: unknown} =>
  !!value && typeof value === 'object';

const isRefused = (err: unknown, depth: number): boolean => {
  if (!isObject(err) || depth > maxDepth) {
    return false;
  }

  // Node gives an AggregateError if each address of a host refuses. Its code
  // is the code of the first error only, so each error must be a refusal.
  if (Array.isArray(err.errors)) {
    return (
      err.errors.length > 0 && err.errors.every(n => isRefused(n, depth + 1))
    );
  }

  if (typeof err.code === 'string' && refusedCodes.includes(err.code)) {
    return true;
  }

  return isRefused(err.cause, depth + 1);
};

/** Check if a fetch error is a refused connect

  A refused connect shows that no program listens at the address. The method
  knows these shapes:
  - bun: the error has the code ConnectionRefused.
  - Node: the cause of the error has the code ECONNREFUSED.
  - Node: the cause of the error is an AggregateError, and each of its errors
    has the code ECONNREFUSED.

  In bun, a host name that does not resolve also gives the code
  ConnectionRefused. Thus use this check only with localhost or an IP address.

  <Fetch Error Object>

  @returns
  <Connect Is Refused Bool>
*/
export default (err: unknown) => isRefused(err, 0);
