// A connect error of Node, with the code of the system call
const connectError = (code: string, address: string) =>
  Object.assign(new Error(`connect ${code} ${address}:37373`), {code});

/** Fetch error of bun for a refused connect */
export const bunRefused = () =>
  Object.assign(
    new Error('Unable to connect. Is the computer able to access the url?'),
    {code: 'ConnectionRefused'},
  );

/** Fetch error of Node for a refused connect */
export const nodeRefused = () =>
  new TypeError('fetch failed', {
    cause: connectError('ECONNREFUSED', '127.0.0.1'),
  });

/** Fetch error of Node if each address of the host refuses */
export const aggregateRefused = () => {
  const errors = [
    connectError('ECONNREFUSED', '::1'),
    connectError('ECONNREFUSED', '127.0.0.1'),
  ];

  // Node gives the AggregateError the code of its first error
  const cause = Object.assign(new AggregateError(errors), {
    code: 'ECONNREFUSED',
  });

  return new TypeError('fetch failed', {cause});
};

/** Fetch error of Node if one address refuses and one address times out */
export const aggregateMixed = () => {
  const errors = [
    connectError('ECONNREFUSED', '::1'),
    connectError('ETIMEDOUT', '127.0.0.1'),
  ];

  const cause = Object.assign(new AggregateError(errors), {
    code: 'ECONNREFUSED',
  });

  return new TypeError('fetch failed', {cause});
};

/** Fetch error of Node for a host name that does not resolve */
export const nodeNotFound = () =>
  new TypeError('fetch failed', {
    cause: Object.assign(new Error('getaddrinfo ENOTFOUND polar.invalid'), {
      code: 'ENOTFOUND',
    }),
  });
