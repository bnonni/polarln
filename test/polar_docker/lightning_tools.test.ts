import {deepStrictEqual} from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';

import {closeChannel} from '../../src/index.js';
import {createInvoice} from '../../src/index.js';
import {createNetwork} from '../../src/index.js';
import {depositFunds} from '../../src/index.js';
import {getNodeInfo} from '../../src/index.js';
import {openChannel} from '../../src/index.js';
import {payInvoice} from '../../src/index.js';
import {polarDocker} from '../../src/index.js';
import {rejection} from '../fixtures/rejection.js';

test('Lightning tools reject bad arguments as the bridge does', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'polarln-docker-'));

  try {
    const {polar} = polarDocker({dataDir});

    await createNetwork({name: 'n', polar});

    const tests = [
      {
        error: [
          400,
          'PolarRejectedArguments',
          'Cannot open channel between the same node',
        ],
        run: () =>
          openChannel({
            fromNode: 'alice',
            networkId: 1,
            polar,
            sats: 1,
            toNode: 'alice',
          }),
      },
      {
        error: [
          400,
          'PolarRejectedArguments',
          'Channel capacity in sats must be greater than 0',
        ],
        run: () =>
          openChannel({
            fromNode: 'alice',
            networkId: 1,
            polar,
            sats: 0,
            toNode: 'bob',
          }),
      },
      {
        error: [
          404,
          'PolarNodeNotFound',
          'Lightning node "x" not found in network',
        ],
        run: () => getNodeInfo({networkId: 1, nodeName: 'x', polar}),
      },
      {
        error: [400, 'PolarRejectedArguments', 'Channel point is required'],
        run: () =>
          closeChannel({channelPoint: '', networkId: 1, nodeName: 'a', polar}),
      },
      {
        error: [
          400,
          'PolarRejectedArguments',
          'Amount in sats must be greater than 0',
        ],
        run: () => depositFunds({networkId: 1, nodeName: 'a', polar, sats: 0}),
      },
      {
        error: [400, 'PolarRejectedArguments', 'Amount must be greater than 0'],
        run: () =>
          createInvoice({amount: 0, networkId: 1, nodeName: 'a', polar}),
      },
      {
        error: [400, 'PolarRejectedArguments', 'fromNode name is required'],
        run: () =>
          payInvoice({fromNode: '', invoice: 'i', networkId: 1, polar}),
      },
    ];

    for (const {error, run} of tests) {
      const [code, message, details] = (await rejection(run())) as [
        number,
        string,
        {err: string},
      ];

      deepStrictEqual([code, message, details.err], error);
    }
  } finally {
    await rm(dataDir, {force: true, recursive: true});
  }
});
