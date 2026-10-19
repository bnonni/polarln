// The lnd response fields that Polar reads (camelCase, longs as strings).

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
