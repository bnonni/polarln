import {equal} from 'node:assert/strict';
import test from 'node:test';

import decodeSerialized from '../../src/lnd_grpc/decode_serialized.js';

const macaroon =
  '0201036c6e6402eb01030a10b99ebfe62d1ccf6a9e099bf9795ac56b1201301a160a0761646472657373120472656164120577726974651a130a04696e666f120472656164120577726974651a170a08696e766f69636573120472656164120577726974651a140a086d616361726f6f6e120867656e65726174651a160a076d657373616765120472656164120577726974651a170a086f6666636861696e120472656164120577726974651a160a076f6e636861696e120472656164120577726974651a140a057065657273120472656164120577726974651a180a067369676e6572120867656e6572617465120472656164000006203214b3a271a3304fd21d6e395c3f67a66c321ae3a38d9186f36c718ae14a0b63';

const tests = [
  {
    args: {serialized: macaroon},
    description: 'A hex macaroon returns a decoded macaroon',
    expected: {decoded: macaroon},
  },
  {
    args: {serialized: Buffer.from(macaroon, 'hex').toString('base64')},
    description: 'A base64 macaroon returns a decoded macaroon',
    expected: {decoded: macaroon},
  },
  {
    args: {},
    description: 'No macaroon returns nothing',
    expected: {},
  },
];

tests.forEach(({args, description, expected}) => {
  return test(description, () => {
    const res = decodeSerialized(args);

    equal(res.decoded?.toString('hex'), expected.decoded, 'Got decoded data');

    return;
  });
});
