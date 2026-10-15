import toolMethod from '../polar_bridge/tool_method.js';

type LitdNodeArgs = {networkId: number; nodeName: string};
type LitdNodeResult = {
  message: string;
  networkId: number;
  nodeName: string;
  success: boolean;
};

export type LitdSession = {
  accountId: string;
  /** Created At Unix Seconds */
  createdAt: number;
  /** Expires At Unix Seconds */
  expiresAt: number;
  id: string;
  label: string;
  localPublicKey: string;
  mailboxServerAddr: string;
  /** LNC Pairing Phrase */
  pairingPhrase: string;
  remotePublicKey: string;
  state: 'Created' | 'Expired' | 'In Use' | 'Reserved' | 'Revoked';
  type:
    | 'Account'
    | 'Admin'
    | 'Autopilot'
    | 'Custom'
    | 'Read Only'
    | 'UI Password';
};

export type AddLitdSessionArgs = LitdNodeArgs & {
  /** Expires At Unix Seconds (default: 90 days from now) */
  expiresAt?: number;
  label: string;
  /** Mailbox Server (default: mailbox.terminal.lightning.today:443) */
  mailboxServerAddr?: string;
  type: 'admin' | 'read_only';
};
export type AddLitdSessionResult = LitdNodeResult & {session: LitdSession};

export type ListLitdSessionsArgs = LitdNodeArgs;
export type ListLitdSessionsResult = LitdNodeResult & {
  sessions: LitdSession[];
};

export type RevokeLitdSessionArgs = LitdNodeArgs & {localPublicKey: string};
export type RevokeLitdSessionResult = LitdNodeResult;

/** Add a Lightning Node Connect session to a litd node */
export const addLitdSession = toolMethod<
  AddLitdSessionArgs,
  AddLitdSessionResult
>('add_litd_session');

/** List the Lightning Node Connect sessions of a litd node */
export const listLitdSessions = toolMethod<
  ListLitdSessionsArgs,
  ListLitdSessionsResult
>('list_litd_sessions');

/** Revoke a Lightning Node Connect session of a litd node */
export const revokeLitdSession = toolMethod<
  RevokeLitdSessionArgs,
  RevokeLitdSessionResult
>('revoke_litd_session');
