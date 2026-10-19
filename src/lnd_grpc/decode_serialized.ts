const {from} = Buffer;
const isHex = (n: string) => !(n.length % 2) && /^[0-9A-F]*$/i.test(n);

/** Get decoded Base64 or Hex encoded data

  {
    [serialized]: <Serialized Data String>
  }

  @returns
  {
    [decoded]: <Deserialized Data Buffer>
  }
*/
export default ({serialized}: {serialized?: string}): {decoded?: Buffer} => {
  if (!!serialized && !isHex(serialized)) {
    return {decoded: from(serialized, 'base64')};
  }

  if (!!serialized && isHex(serialized)) {
    return {decoded: from(serialized, 'hex')};
  }

  return {};
};
