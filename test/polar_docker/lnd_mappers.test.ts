import {deepStrictEqual} from 'node:assert/strict';
import test from 'node:test';

import {mapOpenChannel} from '../../src/polar_docker/lnd_mappers.js';
import {mapPendingChannel} from '../../src/polar_docker/lnd_mappers.js';

const json = (data: object) => new TextEncoder().encode(JSON.stringify(data));

const open = {
  active: true,
  capacity: '250000',
  chanId: '1',
  channelPoint: 'txid:0',
  customChannelData: new Uint8Array(),
  initiator: true,
  localBalance: '200000',
  private: true,
  remoteBalance: '1000',
  remotePubkey: 'bob',
};

test('An open lnd channel maps to a Polar channel', () => {
  deepStrictEqual(mapOpenChannel(open), {
    pending: false,
    uniqueId: 'txid-0',
    channelPoint: 'txid:0',
    pubkey: 'bob',
    capacity: '250000',
    localBalance: '200000',
    remoteBalance: '1000',
    status: 'Open',
    isPrivate: true,
    assets: [],
  });
});

test('A pending lnd channel maps to a Polar channel', () => {
  const pending = {
    capacity: '100',
    channelPoint: 'txid:1',
    customChannelData: new Uint8Array(),
    initiator: 'INITIATOR_LOCAL',
    localBalance: '90',
    remoteBalance: '0',
    remoteNodePub: 'carol',
  };

  deepStrictEqual(mapPendingChannel('Closing')(pending), {
    pending: true,
    uniqueId: 'txid-1',
    channelPoint: 'txid:1',
    pubkey: 'carol',
    capacity: '100',
    localBalance: '90',
    remoteBalance: '0',
    status: 'Closing',
    isPrivate: false,
    assets: [],
  });
});

test('The tapd custom channel data gives the channel assets', () => {
  const genesis = {asset_id: 'id', name: 'coin'};

  const tests = [
    {
      description: 'tapd v0.6 and up',
      data: json({
        funding_assets: [
          {amount: 50, asset_genesis: genesis, decimal_display: 2},
        ],
        group_key: 'key',
        local_assets: [{amount: '30'}, {amount: '5'}],
        remote_assets: [{amount: '15'}],
      }),
      expected: {
        capacity: '50',
        decimals: 2,
        groupKey: 'key',
        id: 'id',
        localBalance: '35',
        name: 'coin',
        remoteBalance: '15',
      },
    },
    {
      description: 'tapd v0.5',
      data: json({
        assets: [
          {
            asset_utxo: {asset_genesis: genesis, decimal_display: 0},
            capacity: 50,
            local_balance: 40,
            remote_balance: 10,
          },
        ],
      }),
      expected: {
        capacity: '50',
        decimals: 0,
        groupKey: undefined,
        id: 'id',
        localBalance: '40',
        name: 'coin',
        remoteBalance: '10',
      },
    },
  ];

  tests.forEach(({data, description, expected}) => {
    deepStrictEqual(
      mapOpenChannel({...open, customChannelData: data}).assets,
      [expected],
      description,
    );
  });

  deepStrictEqual(
    mapOpenChannel({...open, customChannelData: json({})}).assets,
    [],
    'No assets',
  );

  deepStrictEqual(
    mapOpenChannel({...open, customChannelData: new Uint8Array([123])}).assets,
    [],
    'Bad JSON gives no assets',
  );
});
