import toolMethod from '../polar_bridge/tool_method.js';
import type {NodeImplementation} from '../typescript/index.js';
import type {PolarNode} from '../typescript/index.js';
import type {Status} from '../typescript/index.js';

type NodeArgs = {networkId: number; nodeName: string};
type NodeResult = {message: string; success: boolean};
type NodeStatusResult = NodeResult & {
  networkId: number;
  nodeName: string;
  nodeStatus: Status;
};

export type AddNodeArgs = {
  implementation: NodeImplementation;
  networkId: number;
  /** Stock Version (default: the latest version) */
  version?: string;
};
export type AddNodeResult = NodeResult & {node: PolarNode};

export type GetDefaultNodeCommandArgs = {
  implementation: NodeImplementation;
  version?: string;
};
export type GetDefaultNodeCommandResult = NodeResult & {
  command: string;
  implementation: NodeImplementation;
  version: string;
};

export type ListNodeVersionsArgs = {
  implementation?: Exclude<NodeImplementation, 'btcd'>;
};
export type ListNodeVersionsResult = {
  /** Required Bitcoin Core Version by Node Version */
  compatibility: Partial<Record<NodeImplementation, Record<string, string>>>;
  latest: Partial<Record<NodeImplementation, string>>;
  message: string;
  versions: Partial<Record<NodeImplementation, string[]>>;
};

export type RemoveNodeArgs = NodeArgs;
export type RemoveNodeResult = NodeResult;

export type RenameNodeArgs = {
  networkId: number;
  newName: string;
  oldName: string;
};
export type RenameNodeResult = NodeResult;

export type RestartNodeArgs = NodeArgs;
export type RestartNodeResult = NodeStatusResult;

export type SetLightningBackendArgs = {
  bitcoinNodeName: string;
  lightningNodeName: string;
  networkId: number;
};
export type SetLightningBackendResult = NodeResult & SetLightningBackendArgs;

export type SetTapBackendArgs = {
  lndNodeName: string;
  networkId: number;
  tapNodeName: string;
};
export type SetTapBackendResult = NodeResult & SetTapBackendArgs;

export type StartNodeArgs = NodeArgs;
export type StartNodeResult = NodeStatusResult;

export type StopNodeArgs = NodeArgs;
export type StopNodeResult = NodeStatusResult;

export type UpdateNodeCommandArgs = NodeArgs & {
  /** Docker Command (empty string resets to the default command) */
  command: string;
};
export type UpdateNodeCommandResult = NodeResult & UpdateNodeCommandArgs;

/** Add a node with a stock version to a network */
export const addNode = toolMethod<AddNodeArgs, AddNodeResult>('add_node');

/** Get the default Docker command of a node implementation */
export const getDefaultNodeCommand = toolMethod<
  GetDefaultNodeCommandArgs,
  GetDefaultNodeCommandResult
>('get_default_node_command');

/** List the stock versions of each node implementation */
export const listNodeVersions = toolMethod<
  ListNodeVersionsArgs,
  ListNodeVersionsResult
>('list_node_versions');

/** Remove a node from a network */
export const removeNode = toolMethod<RemoveNodeArgs, RemoveNodeResult>(
  'remove_node',
);

/** Rename a node in a stopped network */
export const renameNode = toolMethod<RenameNodeArgs, RenameNodeResult>(
  'rename_node',
);

/** Restart a node */
export const restartNode = toolMethod<RestartNodeArgs, RestartNodeResult>(
  'restart_node',
);

/** Set the Bitcoin backend of a Lightning node */
export const setLightningBackend = toolMethod<
  SetLightningBackendArgs,
  SetLightningBackendResult
>('set_lightning_backend');

/** Set the lnd backend of a tapd node */
export const setTapBackend = toolMethod<SetTapBackendArgs, SetTapBackendResult>(
  'set_tap_backend',
);

/** Start a node */
export const startNode = toolMethod<StartNodeArgs, StartNodeResult>(
  'start_node',
);

/** Stop a node */
export const stopNode = toolMethod<StopNodeArgs, StopNodeResult>('stop_node');

/** Set the Docker command of a node */
export const updateNodeCommand = toolMethod<
  UpdateNodeCommandArgs,
  UpdateNodeCommandResult
>('update_node_command');
