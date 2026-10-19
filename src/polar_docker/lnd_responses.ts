// The lnd response fields that Polar reads (camelCase, longs as strings).

import type {LndChannel} from './lnd_mappers.js';
import type {LndPendingChannel} from './lnd_mappers.js';

export type GetInfoResponse = {
  alias: string;
  blockHeight: number;
  identityPubkey: string;
  numActiveChannels: number;
  numInactiveChannels: number;
  numPendingChannels: number;
  syncedToChain: boolean;
  uris: string[];
};

export type GetStateResponse = {
  state:
    | 'LOCKED'
    | 'NON_EXISTING'
    | 'RPC_ACTIVE'
    | 'SERVER_ACTIVE'
    | 'UNLOCKED'
    | 'WAITING_TO_START';
};

export type ListPeersResponse = {peers: {address: string; pubKey: string}[]};

export type AddInvoiceResponse = {paymentRequest: string};

export type ChannelEdge = {
  node1Policy: object | null;
  node2Policy: object | null;
};

export type ChannelPoint = {
  fundingTxidBytes?: Uint8Array;
  fundingTxidStr?: string;
  outputIndex: number;
};

export type ListChannelsResponse = {channels: LndChannel[]};

export type Payment = {
  failureReason: string;
  paymentPreimage: string;
  status: 'FAILED' | 'IN_FLIGHT' | 'INITIATED' | 'SUCCEEDED' | 'UNKNOWN';
};

export type PayReq = {destination: string; numSatoshis: string};

export type PendingChannelsResponse = {
  pendingClosingChannels: {channel: LndPendingChannel}[];
  pendingForceClosingChannels: {channel: LndPendingChannel}[];
  pendingOpenChannels: {channel: LndPendingChannel}[];
  waitingCloseChannels: {channel: LndPendingChannel}[];
};

export type WalletBalanceResponse = {
  confirmedBalance: string;
  totalBalance: string;
  unconfirmedBalance: string;
};
