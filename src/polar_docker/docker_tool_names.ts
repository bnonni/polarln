/** Names of the Polar Tools That the Docker Backend Supports

  This file has no imports, so the CLI can read the names without the Docker
  backend code
*/
export const dockerToolNames = [
  'add_node',
  'close_channel',
  'create_invoice',
  'create_network',
  'delete_network',
  'deposit_funds',
  'get_bitcoin_wallet_info',
  'get_blockchain_info',
  'get_default_node_command',
  'get_new_bitcoin_address',
  'get_node_info',
  'get_wallet_balance',
  'list_channels',
  'list_networks',
  'list_node_versions',
  'mine_blocks',
  'open_channel',
  'pay_invoice',
  'remove_node',
  'rename_network',
  'rename_node',
  'restart_node',
  'send_bitcoin',
  'set_auto_mine_mode',
  'set_lightning_backend',
  'start_network',
  'start_node',
  'stop_network',
  'stop_node',
  'update_node_command',
] as const;

export type DockerToolName = (typeof dockerToolNames)[number];

/** Names of the Docker Tools That Do Not Change Files or Containers

  These tools read files, or they use the RPC of the nodes. Each other tool
  checks that the Polar app does not run before it changes the Polar files.
  Thus a new tool gets the check, unless this list has its name.
*/
export const readToolNames = [
  'close_channel',
  'create_invoice',
  'deposit_funds',
  'get_bitcoin_wallet_info',
  'get_blockchain_info',
  'get_default_node_command',
  'get_new_bitcoin_address',
  'get_node_info',
  'get_wallet_balance',
  'list_channels',
  'list_networks',
  'list_node_versions',
  'mine_blocks',
  'open_channel',
  'pay_invoice',
  'send_bitcoin',
] as const satisfies readonly DockerToolName[];
