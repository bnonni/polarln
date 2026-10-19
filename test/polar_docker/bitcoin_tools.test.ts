import {deepStrictEqual} from 'node:assert/strict';
import {equal} from 'node:assert/strict';
import {createServer} from 'node:http';
import type {AddressInfo} from 'node:net';
import {mkdtemp} from 'node:fs/promises';
import {readFile} from 'node:fs/promises';
import {rm} from 'node:fs/promises';
import {writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';

import {createNetwork} from '../../src/index.js';
import {getBitcoinWalletInfo} from '../../src/index.js';
import {getBlockchainInfo} from '../../src/index.js';
import {getNewBitcoinAddress} from '../../src/index.js';
import {listNetworks} from '../../src/index.js';
import {mineBlocks} from '../../src/index.js';
import {polarDocker} from '../../src/index.js';
import {sendBitcoin} from '../../src/index.js';
import {setAutoMineMode} from '../../src/index.js';
import type {PolarDocker} from '../../src/index.js';
import {rejection} from '../fixtures/rejection.js';

type Call = {method: string; params: unknown[]};
type Results = {[method: string]: unknown};

// Start a fake bitcoind JSON-RPC server that records the calls
const fakeBitcoind = async (results: Results) => {
  const calls: Call[] = [];

  const server = createServer((req, res) => {
    let body = '';

    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      const {method, params} = JSON.parse(body) as Call;

      calls.push({method, params});

      res.end(
        JSON.stringify({error: null, id: method, result: results[method]}),
      );
    });
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));

  const {port} = server.address() as AddressInfo;

  return {calls, close: () => server.close(), port};
};

// Make a network with one bitcoind node on the fake server port
const withNetwork = async (
  results: Results,
  use: (args: {calls: Call[]; polar: PolarDocker}) => Promise<void>,
) => {
  const dataDir = await mkdtemp(join(tmpdir(), 'polarln-docker-'));
  const bitcoind = await fakeBitcoind(results);

  try {
    const {polar} = polarDocker({dataDir});

    await createNetwork({name: 'n', polar});

    const file = join(dataDir, 'networks', 'networks.json');
    const json = JSON.parse(await readFile(file, 'utf8'));

    json.networks[0].nodes.bitcoin[0].ports.rpc = bitcoind.port;

    await writeFile(file, JSON.stringify(json));

    await use({calls: bitcoind.calls, polar});
  } finally {
    bitcoind.close();

    await rm(dataDir, {force: true, recursive: true});
  }
};

test('Blocks can be mined', () => {
  const results = {generatetoaddress: ['hash'], getnewaddress: 'bcrt1q'};

  return withNetwork(results, async ({calls, polar}) => {
    const mined = await mineBlocks({networkId: 1, polar});

    deepStrictEqual(
      mined,
      {
        success: true,
        message: 'Mined 6 blocks on node "backend1"',
        networkId: 1,
        nodeName: 'backend1',
        blocksMined: 6,
      },
      'Got mined blocks',
    );

    deepStrictEqual(
      calls.at(-1),
      {method: 'generatetoaddress', params: [6, 'bcrt1q']},
      'Mined to a new address',
    );
  });
});

test('The blockchain and the wallet info can be read', () => {
  const results = {
    getbalances: {mine: {immature: 3, trusted: 1, untrusted_pending: 2}},
    getblockchaininfo: {
      bestblockhash: 'hash',
      blocks: 101,
      chain: 'regtest',
      difficulty: 4.6e-10,
      headers: 101,
      mediantime: 1,
      pruned: false,
      verificationprogress: 1,
    },
    getwalletinfo: {txcount: 5, walletname: ''},
  };

  return withNetwork(results, async ({polar}) => {
    deepStrictEqual(
      await getBlockchainInfo({networkId: 1, polar}),
      {
        success: true,
        nodeName: 'backend1',
        chain: 'regtest',
        blocks: 101,
        headers: 101,
        bestblockhash: 'hash',
        difficulty: 4.6e-10,
        mediantime: 1,
        verificationprogress: 1,
      },
      'Got blockchain info',
    );

    const {walletInfo} = await getBitcoinWalletInfo({
      networkId: 1,
      nodeName: 'backend1',
      polar,
    });

    deepStrictEqual(
      walletInfo as object,
      {
        txcount: 5,
        walletname: '',
        balance: 1,
        unconfirmed_balance: 2,
        immature_balance: 3,
      },
      'Got wallet info with balances',
    );
  });
});

test('A send mines the coins that the wallet does not have', () => {
  const results = {
    generatetoaddress: ['hash'],
    getbalances: {mine: {immature: 0, trusted: 0, untrusted_pending: 0}},
    getblockchaininfo: {blocks: 1},
    getnewaddress: 'bcrt1q',
    listtransactions: [{confirmations: 100}],
    sendtoaddress: 'txid',
  };

  return withNetwork(results, async ({calls, polar}) => {
    const sent = await sendBitcoin({
      amount: 1,
      fromNode: 'backend1',
      networkId: 1,
      polar,
      toAddress: 'bcrt1p',
    });

    deepStrictEqual(
      sent,
      {
        success: true,
        message: 'Sent 1 bitcoin from "backend1" to bcrt1p',
        networkId: 1,
        fromNode: 'backend1',
        toAddress: 'bcrt1p',
        amount: 1,
        txid: 'txid',
      },
      'Got sent coins',
    );

    deepStrictEqual(
      calls.filter(c => c.method === 'generatetoaddress').map(c => c.params[0]),
      [1],
      'Mined the coins',
    );
  });
});

test('A lightning node address needs a running LND node', () => {
  return withNetwork({getnewaddress: 'bcrt1q'}, async ({polar}) => {
    const btc = await getNewBitcoinAddress({networkId: 1, polar});

    deepStrictEqual(
      [btc.address, btc.nodeName, btc.nodeType, btc.message],
      [
        'bcrt1q',
        'backend1',
        'bitcoin',
        'Generated new Bitcoin address for "backend1": bcrt1q',
      ],
      'Got bitcoin node address',
    );

    const [code, message] = (await rejection(
      getNewBitcoinAddress({networkId: 1, nodeName: 'alice', polar}),
    )) as [number, string];

    deepStrictEqual(
      [code, message],
      [503, 'PolarToolFailed'],
      'The LND node does not run',
    );
  });
});

test('The auto mine mode is saved', () => {
  return withNetwork({}, async ({polar}) => {
    const set = await setAutoMineMode({mode: 30, networkId: 1, polar});

    deepStrictEqual(
      set,
      {
        success: true,
        message: 'Set auto-mine mode to "Every 30 seconds" for network "n"',
        networkId: 1,
        mode: 30,
        modeName: 'Every 30 seconds',
      },
      'Got mode',
    );

    const [network] = (await listNetworks({polar})).networks;

    equal(network.autoMineMode, 30, 'The mode is saved');
  });
});

test('Bitcoin tools reject bad arguments as the bridge does', () => {
  return withNetwork({}, async ({polar}) => {
    const tests = [
      {
        error: [
          400,
          'PolarRejectedArguments',
          'Number of blocks must be greater than 0',
        ],
        run: () => mineBlocks({blocks: 0, networkId: 1, polar}),
      },
      {
        error: [
          404,
          'PolarNodeNotFound',
          'Bitcoin node "x" not found in network',
        ],
        run: () => getBlockchainInfo({networkId: 1, nodeName: 'x', polar}),
      },
      {
        error: [400, 'PolarRejectedArguments', 'Amount must be greater than 0'],
        run: () =>
          sendBitcoin({
            amount: 0,
            fromNode: 'backend1',
            networkId: 1,
            polar,
            toAddress: 'a',
          }),
      },
      {
        error: [
          400,
          'PolarRejectedArguments',
          'Invalid mode: 5. Valid modes are: 0, 30, 60, 300, 600',
        ],
        run: () => setAutoMineMode({mode: 5 as 0, networkId: 1, polar}),
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
  });
});
