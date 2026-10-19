// Ported from jamaljsr/polar (MIT): src/store/models/mcp/helpers.ts.

/** Make sure that there is a network id

  @throws
  <Error>
*/
export const validateNetworkId = (networkId: unknown) => {
  if (!networkId) {
    throw new Error('Network ID is required');
  }
};

/** Make sure that there is a value

  @throws
  <Error>
*/
export const validateRequired = (value: unknown, fieldName: string) => {
  if (!value) {
    throw new Error(`${fieldName} is required`);
  }
};
