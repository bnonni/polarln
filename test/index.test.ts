import {deepStrictEqual} from 'node:assert/strict';
import test from 'node:test';

import * as polarln from '../src/index.js';

test('The package loads', () => {
  deepStrictEqual(typeof polarln, 'object');
});
