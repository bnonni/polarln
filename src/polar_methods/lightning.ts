import toolMethod from '../polar_bridge/tool_method.js';

type LightningNodeArgs = {networkId: number; nodeName: string};
type LightningNodeResult = {
  message: string;
  networkId: number;
  nodeName: string;
  success: boolean;
};

export type ChannelAsset = {
  /** Asset Capacity Units */
  capacity: string;
  decimals: number;
  groupKey?: string;
  id: string;
  localBalance: string;
  name: string;
  remoteBalance: string;
};

export type Channel = {
  assets?: ChannelAsset[];
  /** Capacity Sats */
  capacity: string;
  /** Funding Outpoint (txid:vout) */
  channelPoint: string;
  isPrivate: boolean;
  localBalance: string;
  pending: boolean;
  /** Peer Public Key */
  pubkey: string;
  remoteBalance: string;
  status:
    | 'Closed'
    | 'Closing'
    | 'Error'
    | 'Force Closing'
    | 'Open'
    | 'Opening'
    | 'Waiting to Close';
  uniqueId: string;
};

export type CloseChannelArgs = LightningNodeArgs & {channelPoint: string};
export type CloseChannelResult = LightningNodeResult & {channelPoint: string};

export type CreateInvoiceArgs = LightningNodeArgs & {
  /** Sats */
  amount: number;
  memo?: string;
};
export type CreateInvoiceResult = LightningNodeResult & {
  amount: number;
  invoice: string;
  memo?: string;
};

export type DepositFundsArgs = LightningNodeArgs & {sats: number};
export type DepositFundsResult = LightningNodeResult & {sats: number};

export type GetNodeInfoArgs = LightningNodeArgs;
export type GetNodeInfoResult = LightningNodeResult & {
  info: {
    alias: string;
    blockHeight: number;
    numActiveChannels: number;
    numInactiveChannels: number;
    numPendingChannels: number;
    pubkey: string;
    /** Node URI (pubkey@host:port) */
    rpcUrl: string;
    syncedToChain: boolean;
  };
};

export type GetWalletBalanceArgs = LightningNodeArgs;
export type GetWalletBalanceResult = LightningNodeResult & {
  /** On-Chain Sats */
  balance: {confirmed: string; total: string; unconfirmed: string};
};

export type ListChannelsArgs = LightningNodeArgs;
export type ListChannelsResult = LightningNodeResult & {channels: Channel[]};

export type OpenChannelArgs = {
  /** Deposit Funds to the Opener if Its Balance Is Too Low (default: true) */
  autoFund?: boolean;
  fromNode: string;
  isPrivate?: boolean;
  networkId: number;
  /** Capacity Sats */
  sats: number;
  toNode: string;
};
export type OpenChannelResult = {
  capacity: number;
  channelPoint: string;
  fromNode: string;
  message: string;
  networkId: number;
  success: boolean;
  toNode: string;
};

export type PayInvoiceArgs = {
  /** Sats for an Invoice Without an Amount */
  amount?: number;
  fromNode: string;
  invoice: string;
  networkId: number;
};
export type PayInvoiceResult = {
  amount?: number;
  destination: string;
  fromNode: string;
  invoice: string;
  message: string;
  networkId: number;
  preimage: string;
  success: boolean;
};

/** Close a Lightning channel */
export const closeChannel = toolMethod<CloseChannelArgs, CloseChannelResult>(
  'close_channel',
);

/** Create a Lightning invoice */
export const createInvoice = toolMethod<CreateInvoiceArgs, CreateInvoiceResult>(
  'create_invoice',
);

/** Send on-chain funds to a Lightning node and mine blocks to confirm */
export const depositFunds = toolMethod<DepositFundsArgs, DepositFundsResult>(
  'deposit_funds',
);

/** Get the info of a Lightning node */
export const getNodeInfo = toolMethod<GetNodeInfoArgs, GetNodeInfoResult>(
  'get_node_info',
);

/** Get the on-chain balance of a Lightning node */
export const getWalletBalance = toolMethod<
  GetWalletBalanceArgs,
  GetWalletBalanceResult
>('get_wallet_balance');

/** List the channels of a Lightning node */
export const listChannels = toolMethod<ListChannelsArgs, ListChannelsResult>(
  'list_channels',
);

/** Open a Lightning channel */
export const openChannel = toolMethod<OpenChannelArgs, OpenChannelResult>(
  'open_channel',
);

/** Pay a Lightning invoice */
export const payInvoice = toolMethod<PayInvoiceArgs, PayInvoiceResult>(
  'pay_invoice',
);
