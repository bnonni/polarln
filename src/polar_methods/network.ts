import toolMethod from '../polar_bridge/tool_method.js';
import type {Network} from '../typescript/index.js';
import type {NodeImplementation} from '../typescript/index.js';

type NetworkResult = {message: string; network: Network; success: boolean};

export type CreateNetworkArgs = {
  description?: string;
  name: string;
  /** Nodes to Create (a missing version means the latest version) */
  nodes?: {
    count?: number;
    implementation: NodeImplementation;
    version?: string;
  }[];
};
export type CreateNetworkResult = NetworkResult;

export type DeleteNetworkArgs = {networkId: number};
export type DeleteNetworkResult = NetworkResult;

export type ExportNetworkToZipArgs = {
  networkId: number;
  /** Absolute .polar.zip Output Path */
  outputPath: string;
};
export type ExportNetworkToZipResult = {
  message: string;
  outputPath: string;
  success: boolean;
};

export type ImportNetworkFromZipArgs = {
  /** Absolute .polar.zip Path */
  path: string;
};
export type ImportNetworkFromZipResult = NetworkResult;

export type ListNetworksResult = {networks: Network[]};

export type RenameNetworkArgs = {
  description?: string;
  name: string;
  networkId: number;
};
export type RenameNetworkResult = NetworkResult;

export type StartNetworkArgs = {networkId: number};
export type StartNetworkResult = NetworkResult;

export type StopNetworkArgs = {networkId: number};
export type StopNetworkResult = NetworkResult;

/** Create a network with nodes */
export const createNetwork = toolMethod<CreateNetworkArgs, CreateNetworkResult>(
  'create_network',
);

/** Delete a network and all of its data (this cannot be undone) */
export const deleteNetwork = toolMethod<DeleteNetworkArgs, DeleteNetworkResult>(
  'delete_network',
);

/** Export a stopped network to a .polar.zip file */
export const exportNetworkToZip = toolMethod<
  ExportNetworkToZipArgs,
  ExportNetworkToZipResult
>('export_network_to_zip');

/** Import a network from a .polar.zip file */
export const importNetworkFromZip = toolMethod<
  ImportNetworkFromZipArgs,
  ImportNetworkFromZipResult
>('import_network_from_zip');

/** List all networks with their nodes, ports, and file paths */
export const listNetworks = toolMethod<object, ListNetworksResult>(
  'list_networks',
);

/** Rename a network */
export const renameNetwork = toolMethod<RenameNetworkArgs, RenameNetworkResult>(
  'rename_network',
);

/** Start all of the nodes in a network */
export const startNetwork = toolMethod<StartNetworkArgs, StartNetworkResult>(
  'start_network',
);

/** Stop all of the nodes in a network */
export const stopNetwork = toolMethod<StopNetworkArgs, StopNetworkResult>(
  'stop_network',
);
