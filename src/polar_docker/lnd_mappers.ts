// Ported from jamaljsr/polar (MIT): src/lib/lightning/lnd/mappers.ts,
// src/utils/objects.ts (snakeKeysToCamel).

/** Polar Channel Asset (from the tapd custom channel data) */
export type ChannelAsset = {
  capacity: string;
  decimals: number;
  groupKey?: string;
  id: string;
  localBalance: string;
  name: string;
  remoteBalance: string;
};

/** Polar Lightning Channel */
export type LightningChannel = {
  assets: ChannelAsset[];
  capacity: string;
  channelPoint: string;
  isPrivate: boolean;
  localBalance: string;
  pending: boolean;
  pubkey: string;
  remoteBalance: string;
  status: 'Closing' | 'Force Closing' | 'Open' | 'Opening' | 'Waiting to Close';
  uniqueId: string;
};

/** lnd Open Channel (the fields that Polar reads) */
export type LndChannel = {
  active: boolean;
  capacity: string;
  chanId: string;
  channelPoint: string;
  customChannelData: Uint8Array;
  initiator: boolean;
  localBalance: string;
  private: boolean;
  remoteBalance: string;
  remotePubkey: string;
};

/** lnd Pending Channel (the fields that Polar reads) */
export type LndPendingChannel = {
  capacity: string;
  channelPoint: string;
  customChannelData: Uint8Array;
  initiator: string;
  localBalance: string;
  remoteBalance: string;
  remoteNodePub: string;
};

type Utxo = {
  amount: number;
  assetGenesis: {assetId: string; name: string};
  decimalDisplay: number;
};

type CustomData = {
  // Only tapd v0.5
  assets?: {
    assetUtxo: Utxo;
    capacity: number;
    localBalance: number;
    remoteBalance: number;
  }[];
  // tapd v0.6 and up
  fundingAssets?: Utxo[];
  groupKey?: string;
  localAssets: {amount: string}[];
  remoteAssets: {amount: string}[];
};

const toCamel = (key: string) =>
  key.replace(/_([a-z])/gi, (_, c: string) => c.toUpperCase());

// Change the snake_case keys of an object and its children to camelCase
const snakeKeysToCamel = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(snakeKeysToCamel);
  }

  if (!!value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [toCamel(k), snakeKeysToCamel(v)]),
    );
  }

  return value;
};

const sum = (assets: {amount: string}[]) =>
  assets.reduce((total, asset) => total + Number(asset.amount), 0).toString();

// Get the assets in the custom channel data JSON of a tapd channel
const parseCustomData = (data?: Uint8Array): ChannelAsset[] => {
  if (!data?.length) {
    return [];
  }

  try {
    const json = Buffer.from(data).toString('utf8');
    const chanData = snakeKeysToCamel(JSON.parse(json)) as CustomData;

    if (!!chanData.assets) {
      return chanData.assets.map(asset => ({
        id: asset.assetUtxo.assetGenesis.assetId,
        name: asset.assetUtxo.assetGenesis.name,
        groupKey: chanData.groupKey,
        capacity: asset.capacity.toString(),
        localBalance: asset.localBalance.toString(),
        remoteBalance: asset.remoteBalance.toString(),
        decimals: asset.assetUtxo.decimalDisplay,
      }));
    }

    if (!!chanData.fundingAssets) {
      return chanData.fundingAssets.map(asset => ({
        id: asset.assetGenesis.assetId,
        name: asset.assetGenesis.name,
        groupKey: chanData.groupKey,
        capacity: asset.amount.toString(),
        localBalance: sum(chanData.localAssets),
        remoteBalance: sum(chanData.remoteAssets),
        decimals: asset.decimalDisplay,
      }));
    }

    return [];
  } catch {
    return [];
  }
};

/** Map an lnd open channel to a Polar channel

  <lnd Channel Object>

  @returns
  <Polar Lightning Channel Object>
*/
export const mapOpenChannel = (chan: LndChannel): LightningChannel => ({
  pending: false,
  uniqueId: chan.channelPoint.replace(':', '-'),
  channelPoint: chan.channelPoint,
  pubkey: chan.remotePubkey,
  capacity: chan.capacity,
  localBalance: chan.localBalance,
  remoteBalance: chan.remoteBalance,
  status: 'Open',
  isPrivate: chan.private,
  assets: parseCustomData(chan.customChannelData),
});

/** Map an lnd pending channel to a Polar channel

  <Channel Status String>

  @returns
  <Map lnd Pending Channel to Polar Lightning Channel Function>
*/
export const mapPendingChannel =
  (status: LightningChannel['status']) =>
  (chan: LndPendingChannel): LightningChannel => ({
    pending: true,
    uniqueId: chan.channelPoint.replace(':', '-'),
    channelPoint: chan.channelPoint,
    pubkey: chan.remoteNodePub,
    capacity: chan.capacity,
    localBalance: chan.localBalance,
    remoteBalance: chan.remoteBalance,
    status,
    isPrivate: false,
    assets: parseCustomData(chan.customChannelData),
  });
