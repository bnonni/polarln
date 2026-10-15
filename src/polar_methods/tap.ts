import toolMethod from '../polar_bridge/tool_method.js';

type TapNodeArgs = {
  networkId: number;
  /** tapd or litd Node Name */
  nodeName: string;
};
type TapNodeResult = {
  message: string;
  networkId: number;
  nodeName: string;
  success: boolean;
};

export type CloseTapChannelArgs = TapNodeArgs & {channelPoint: string};
export type CloseTapChannelResult = TapNodeResult & {channelPoint: string};

export type CreateAssetInvoiceArgs = TapNodeArgs & {
  /** Asset Units */
  amount: number;
  assetId: string;
};
export type CreateAssetInvoiceResult = TapNodeResult & {
  amount: number;
  assetId: string;
  invoice: string;
  sats: number;
};

export type DecodeTapAddressArgs = TapNodeArgs & {address: string};
export type DecodeTapAddressResult = {
  address: string;
  amount: string;
  assetId: string;
  name?: string;
};

export type FundTapChannelArgs = {
  /** Asset Units */
  amount: number;
  assetId: string;
  /** litd Node Name */
  fromNode: string;
  networkId: number;
  /** litd Node Name */
  toNode: string;
};
export type FundTapChannelResult = FundTapChannelArgs & {
  message: string;
  success: boolean;
};

export type GetAssetsInChannelsArgs = TapNodeArgs;
export type GetAssetsInChannelsResult = TapNodeResult & {
  assetsInChannels: {
    asset: {
      capacity: string;
      decimals: number;
      groupKey?: string;
      id: string;
      localBalance: string;
      name: string;
      remoteBalance: string;
    };
    peerPubkey: string;
  }[];
};

export type GetTapAddressArgs = TapNodeArgs & {
  /** Asset Units */
  amount: string;
  assetId: string;
};
export type GetTapAddressResult = {
  amount: string;
  /** Encoded Taproot Assets Address */
  encoded: string;
  family?: string;
  id: string;
  internalKey: string;
  scriptKey: string;
  taprootOutputKey: string;
  type: string;
};

export type GetTapBalancesArgs = TapNodeArgs;
export type GetTapBalancesResult = {
  balances: {
    balance: string;
    genesisPoint: string;
    groupKey?: string;
    id: string;
    name: string;
    type: string;
  }[];
};

export type ListTapAssetsArgs = TapNodeArgs;
export type ListTapAssetsResult = {
  assets: {
    amount: string;
    anchorOutpoint: string;
    decimals: number;
    genesisPoint: string;
    groupKey: string;
    id: string;
    name: string;
    nodeName: string;
    type: string;
  }[];
  networkId: number;
  totalCount: number;
};

export type MintTapAssetArgs = TapNodeArgs & {
  /** Total Supply Units (collectibles are always 1) */
  amount: number;
  assetType: 'collectible' | 'normal';
  /** Fund the lnd Node With BTC if Necessary */
  autoFund?: boolean;
  /** Display Decimals (0 to 8, normal assets only) */
  decimals?: number;
  /** Make an Asset Group for Future Emission */
  enableEmission?: boolean;
  /** Finalize the Batch and Mine Blocks to Confirm */
  finalize?: boolean;
  name: string;
};
export type MintTapAssetResult = TapNodeResult & {
  amount: number;
  assetName: string;
  assetType: string;
  batchKey: string;
};

export type PayAssetInvoiceArgs = {
  assetId: string;
  /** litd Node Name */
  fromNode: string;
  invoice: string;
  networkId: number;
};
export type PayAssetInvoiceResult = PayAssetInvoiceArgs & {
  message: string;
  receipt: {amount: number; destination: string; preimage: string};
  success: boolean;
};

export type SendTapAssetArgs = {
  /** Taproot Assets Address */
  address: string;
  /** Fund the lnd Node With BTC if Necessary */
  autoFund?: boolean;
  /** tapd or litd Node Name */
  fromNode: string;
  networkId: number;
};
export type SendTapAssetResult = SendTapAssetArgs & {
  message: string;
  success: boolean;
  /** tapd SendAsset Transfer */
  transfer: unknown;
};

export type SyncTapUniverseArgs = TapNodeArgs & {
  /** tapd or litd Node Name to Sync With */
  universeNodeName: string;
};
export type SyncTapUniverseResult = {syncedAssets: number};

/** Close a Taproot Assets channel between litd nodes */
export const closeTapChannel = toolMethod<
  CloseTapChannelArgs,
  CloseTapChannelResult
>('close_tap_channel');

/** Create a Lightning invoice that a litd node receives as an asset */
export const createAssetInvoice = toolMethod<
  CreateAssetInvoiceArgs,
  CreateAssetInvoiceResult
>('create_asset_invoice');

/** Decode a Taproot Assets address */
export const decodeTapAddress = toolMethod<
  DecodeTapAddressArgs,
  DecodeTapAddressResult
>('decode_tap_address');

/** Open a Taproot Assets channel between litd nodes */
export const fundTapChannel = toolMethod<
  FundTapChannelArgs,
  FundTapChannelResult
>('fund_tap_channel');

/** Get the assets in the channels of a litd node */
export const getAssetsInChannels = toolMethod<
  GetAssetsInChannelsArgs,
  GetAssetsInChannelsResult
>('get_assets_in_channels');

/** Get a new Taproot Assets address */
export const getTapAddress = toolMethod<GetTapAddressArgs, GetTapAddressResult>(
  'get_tap_address',
);

/** Get the asset balances of a tapd or litd node */
export const getTapBalances = toolMethod<
  GetTapBalancesArgs,
  GetTapBalancesResult
>('get_tap_balances');

/** List the assets of a tapd or litd node */
export const listTapAssets = toolMethod<ListTapAssetsArgs, ListTapAssetsResult>(
  'list_tap_assets',
);

/** Mint a Taproot Asset */
export const mintTapAsset = toolMethod<MintTapAssetArgs, MintTapAssetResult>(
  'mint_tap_asset',
);

/** Pay a Lightning invoice with an asset from a litd node */
export const payAssetInvoice = toolMethod<
  PayAssetInvoiceArgs,
  PayAssetInvoiceResult
>('pay_asset_invoice');

/** Send an asset to a Taproot Assets address */
export const sendTapAsset = toolMethod<SendTapAssetArgs, SendTapAssetResult>(
  'send_tap_asset',
);

/** Sync the universe of a tapd or litd node with another node */
export const syncTapUniverse = toolMethod<
  SyncTapUniverseArgs,
  SyncTapUniverseResult
>('sync_tap_universe');
