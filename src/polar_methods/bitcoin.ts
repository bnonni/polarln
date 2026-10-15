import toolMethod from '../polar_bridge/tool_method.js';
import type {AutoMineMode} from '../typescript/index.js';

type BitcoinNodeArgs = {
  networkId: number;
  /** Bitcoin Node Name (default: the first Bitcoin node) */
  nodeName?: string;
};

export type GetBitcoinWalletInfoArgs = BitcoinNodeArgs;
export type GetBitcoinWalletInfoResult = {
  nodeName: string;
  success: boolean;
  /** bitcoind getwalletinfo Result With Legacy Balance Fields */
  walletInfo: {
    balance: number;
    hdmasterkeyid: string;
    immature_balance: number;
    keypoololdest: number;
    keypoolsize: number;
    paytxfee: number;
    txcount: number;
    unconfirmed_balance: number;
    walletname: string;
    walletversion: number;
  };
};

export type GetBlockchainInfoArgs = BitcoinNodeArgs;
export type GetBlockchainInfoResult = {
  bestblockhash: string;
  blocks: number;
  chain: string;
  /** Difficulty (the bridge can send a string) */
  difficulty: number | string;
  headers: number;
  mediantime: number;
  nodeName: string;
  success: boolean;
  verificationprogress: number;
};

export type GetNewBitcoinAddressArgs = {
  networkId: number;
  /** Bitcoin or Lightning Node Name (default: the first Bitcoin node) */
  nodeName?: string;
};
export type GetNewBitcoinAddressResult = {
  address: string;
  message: string;
  networkId: number;
  nodeName: string;
  nodeType: 'bitcoin' | 'lightning';
  success: boolean;
};

export type MineBlocksArgs = BitcoinNodeArgs & {
  /** Blocks to Mine (default: 6) */
  blocks?: number;
};
export type MineBlocksResult = {
  blocksMined: number;
  message: string;
  networkId: number;
  nodeName: string;
  success: boolean;
};

export type SendBitcoinArgs = {
  /** BTC Amount */
  amount: number;
  /** Mine Blocks to Confirm the Transaction */
  autoMine?: boolean;
  /** Bitcoin Node Name */
  fromNode: string;
  networkId: number;
  toAddress: string;
};
export type SendBitcoinResult = {
  amount: number;
  autoMined?: boolean;
  fromNode: string;
  message: string;
  networkId: number;
  success: boolean;
  toAddress: string;
  txid: string;
};

export type SetAutoMineModeArgs = {mode: AutoMineMode; networkId: number};
export type SetAutoMineModeResult = {
  message: string;
  mode: AutoMineMode;
  networkId: number;
  success: boolean;
};

/** Get the wallet info of a Bitcoin node */
export const getBitcoinWalletInfo = toolMethod<
  GetBitcoinWalletInfoArgs,
  GetBitcoinWalletInfoResult
>('get_bitcoin_wallet_info');

/** Get the blockchain info of a Bitcoin node */
export const getBlockchainInfo = toolMethod<
  GetBlockchainInfoArgs,
  GetBlockchainInfoResult
>('get_blockchain_info');

/** Get a new on-chain address from a Bitcoin or Lightning node */
export const getNewBitcoinAddress = toolMethod<
  GetNewBitcoinAddressArgs,
  GetNewBitcoinAddressResult
>('get_new_bitcoin_address');

/** Mine blocks */
export const mineBlocks = toolMethod<MineBlocksArgs, MineBlocksResult>(
  'mine_blocks',
);

/** Send BTC from a Bitcoin node to an address */
export const sendBitcoin = toolMethod<SendBitcoinArgs, SendBitcoinResult>(
  'send_bitcoin',
);

/** Set the automatic mine interval of a network */
export const setAutoMineMode = toolMethod<
  SetAutoMineModeArgs,
  SetAutoMineModeResult
>('set_auto_mine_mode');
