# Docker backend

`polarDocker` (preview) runs the Polar tools on Docker, without the Polar app. It uses the Polar Docker images, the Polar v4.0.0 compose templates, and the Polar v4.0.0 networks file. The methods are the same for the two backends.

Requirements:

- Docker with Docker Compose v2.
- The Polar app is not necessary. To change the networks of the Polar app, the app must not run. See [Polar app check](polar-app.md#polar-app-check).

```ts
import {createNetwork, polarDocker, startNetwork} from 'polarln';

// The data folder is $POLARLN_DATA_DIR, else the Polar home
const {polar} = polarDocker();

const {network} = await createNetwork({polar, name: 'test'});

await startNetwork({polar, networkId: network.id});
```

With no `dataDir`, the tools use the networks of the Polar app. To keep test networks apart from the Polar networks, give a different folder: `polarDocker({dataDir: '/tmp/polarln-test'})`.

The backend object has the full path of the data folder in `polar.dataDir`.

To use this backend in the CLI, see [Backends](cli.md#backends).

## Tools

The backend has 30 tools:

- Network tools: [`createNetwork`](commands/create-network.md), [`deleteNetwork`](commands/delete-network.md), [`listNetworks`](commands/list-networks.md), [`renameNetwork`](commands/rename-network.md), [`startNetwork`](commands/start-network.md), and [`stopNetwork`](commands/stop-network.md).
- Node tools: [`addNode`](commands/add-node.md), [`getDefaultNodeCommand`](commands/get-default-node-command.md), [`listNodeVersions`](commands/list-node-versions.md), [`removeNode`](commands/remove-node.md), [`renameNode`](commands/rename-node.md), [`restartNode`](commands/restart-node.md), [`setLightningBackend`](commands/set-lightning-backend.md), [`startNode`](commands/start-node.md), [`stopNode`](commands/stop-node.md), and [`updateNodeCommand`](commands/update-node-command.md).
- Bitcoin tools: [`getBitcoinWalletInfo`](commands/get-bitcoin-wallet-info.md), [`getBlockchainInfo`](commands/get-blockchain-info.md), [`getNewBitcoinAddress`](commands/get-new-bitcoin-address.md), [`mineBlocks`](commands/mine-blocks.md), [`sendBitcoin`](commands/send-bitcoin.md), and [`setAutoMineMode`](commands/set-auto-mine-mode.md).
- Lightning tools: [`closeChannel`](commands/close-channel.md), [`createInvoice`](commands/create-invoice.md), [`depositFunds`](commands/deposit-funds.md), [`getNodeInfo`](commands/get-node-info.md), [`getWalletBalance`](commands/get-wallet-balance.md), [`listChannels`](commands/list-channels.md), [`openChannel`](commands/open-channel.md), and [`payInvoice`](commands/pay-invoice.md).

The other 18 Polar tools reject with `501 PolarToolNotSupported`:

- The 12 Taproot Assets tools, and `setTapBackend`.
- The 3 litd tools.
- `importNetworkFromZip` and `exportNetworkToZip`.

[`getNodeCredentials`](commands/get-node-credentials.md) also works with this backend. It gets the node paths from `listNetworks`, and it reads the node files.

## Data folder

The data folder comes from the first of these sources that has a value:

1. The `dataDir` argument. In the CLI, the `--data-dir` flag.
2. The `POLARLN_DATA_DIR` environment variable.
3. The Polar home.

An empty value is the same as no value. A relative path starts at the current folder.

The Polar home is the data folder of the Polar app: `~/.local/share/polar` if that folder exists, else `~/.polar`. This is the Polar rule. The Polar app does not read `XDG_DATA_HOME`, so polarln does not read it.

A data folder that is one of these 2 folders is also the Polar home. This includes a path through a symlink, and a folder that the Polar app does not use now.

| Data folder        | Compose project        | Containers             | Polar app check |
| ------------------ | ---------------------- | ---------------------- | --------------- |
| The Polar home     | `polar-network-<id>`   | `polar-n<id>-<name>`   | Yes             |
| A different folder | `polarln-network-<id>` | `polarln-n<id>-<name>` | No              |

In the Polar home, the names are the same as in the Polar app. Thus the app can stop a network that polarln started, and polarln can stop a network that the app started.

In a different folder, the names contain only the network id. Thus 2 such folders cannot run networks with the same id at the same time. The second start gives `409 ContainerNameInUse`, and the containers of the first folder do not change.

The network folder of a network must be `<dataDir>/networks/<id>`. The networks file holds absolute paths, so a copy of a data folder has the paths of the original folder. Thus a tool that uses a network folder of such a copy gives `409 NetworkPathOutsideDataFolder`. It does not change the folders or the containers of the original.

The Polar bridge does not work in CI without a desktop session. In CI, use the Docker backend with a different folder, for example `POLARLN_DATA_DIR=/tmp/polarln`. Then the containers get the `polarln` names, and the Polar app check does not run.

## Networks file

The networks file is `networks/networks.json` in the data folder. polarDocker writes only the Polar v4.0.0 format, in each data folder. It also reads a file of a different version, but a change of that file gives `501` (see [Checks](#checks)).

### Statuses

- The file has the Polar status numbers: 0 (`Starting`), 1 (`Started`), 2 (`Stopping`), 3 (`Stopped`), and 4 (`Error`). The results have the labels, as in the bridge results.
- polarDocker writes only the final statuses 1, 3, and 4. The `Starting` and `Stopping` statuses stay in memory.
- `startNetwork` and `stopNetwork` accept each status. Thus they repair a status 0 or 2 that the Polar app left.
- `startNode`, `stopNode`, and `restartNode` do not accept a node with the status 0 or 2. They give `400 PolarRejectedArguments`.
- A tool that does not start or stop nodes keeps the statuses of the file, also a status 0 or 2.
- A stop of a network also writes the auto-mine mode 0 (Off).

### Writes

- A write keeps the version, the charts, the key order, and the keys that polarDocker does not know. A save with no change gives the same bytes as a Polar save.
- A write keeps the chart of each changed network in sync with its nodes, so that the Polar app can open the network. The positions, the sizes, and the channel links of the other nodes stay.
- A rename keeps the position of the node in the chart.
- A new chart node gets the icon of a node of the same kind in the file. If there is no such node, it gets the icon path of the Polar v4.0.0 build.
- A write goes to a temporary file. The temporary file goes to the disk (fsync), and then a rename replaces the file. A compose file write uses the same steps.
- A lock folder (`networks/networks.json.lock`) makes the changes of 2 processes run one at a time. If a different change holds the lock for more than 3 s, the tool gives `409 NetworksFileBusy`.
- A lock folder that is older than 30 s is from a process that stopped. The next change replaces it.

### Checks

- Before a tool changes files or containers, it checks that it can write the file. A file with a different version, or with a status that is not 0-4, gives `501 PolarToolNotSupported` before any change.
- A file that is not valid JSON, or that has no networks array, gives `503 FailedToReadNetworksFile`. polarDocker does not write such a file. For all the causes, see [Errors](errors.md).
- If there is no networks file, a read shows no networks, and the first write makes a new file. In the Polar home, if network folders exist but the networks file does not, a write gives `503 FailedToReadNetworksFile`. A read still shows no networks.
- A read does not check Docker. `listNetworks` shows the statuses in the file.

## Node kinds

| Tools                                                                                                                                      | Node kinds                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `listNetworks`, `startNetwork`, `stopNetwork`, `deleteNetwork`, `renameNetwork`, `setAutoMineMode`, `startNode`, `stopNode`, `restartNode` | All                                                                       |
| `getBitcoinWalletInfo`, `getBlockchainInfo`, `getNewBitcoinAddress`, `mineBlocks`, `sendBitcoin`                                           | bitcoind, in a network with any node kinds                                |
| The 8 Lightning tools                                                                                                                      | LND and litd                                                              |
| `getNodeCredentials`                                                                                                                       | LND, litd, and tapd                                                       |
| `createNetwork`, `listNodeVersions`, `getDefaultNodeCommand`                                                                               | bitcoind and LND                                                          |
| `addNode`, `removeNode`, `renameNode`, `updateNodeCommand`, `setLightningBackend`                                                          | A network with only bitcoind and LND nodes, and no other compose services |

The tools that take all node kinds:

- `startNetwork`, `stopNetwork`, `deleteNetwork`, `startNode`, `stopNode`, and `restartNode` use the compose file of the network. Thus `startNetwork` and `stopNetwork` also start and stop a service that a user added, for example `electrs`.
- `listNetworks`, `renameNetwork`, and `setAutoMineMode` use only the networks file.

The bitcoind and Lightning tools:

- `getNewBitcoinAddress` also takes an LND or litd node.
- A litd node uses its lnd daemon, as in Polar.
- A Lightning tool on a c-lightning or eclair node gives `501 PolarToolNotSupported`.
- A tapd node is not a Lightning node. Thus a Lightning tool on a tapd node gives `404 PolarNodeNotFound`.

The tools that make networks or show versions:

- `createNetwork`, `listNodeVersions`, and `getDefaultNodeCommand` give `501` for the other Polar node kinds.
- With no implementation, `listNodeVersions` shows only bitcoind and LND. Polar also shows the other node kinds.

The tools that change the nodes of a network (`addNode`, `removeNode`, `renameNode`, `updateNodeCommand`, and `setLightningBackend`):

- These tools write a new compose file.
- A network with a tapd, litd, c-lightning, eclair, or btcd node gives `501` before any change.
- A compose file with a service that is not a node gives `409 ComposeFileHasOtherServices` before any change. The services of an override file also count.
- A compose file with no service for a node is not an error. The new file adds the service.

## Startup checks

`startNetwork` and `startNode` wait for the nodes. Each node gets the `Started` or the `Error` status:

- bitcoind and LND nodes get the Polar checks.
- After a bitcoind node is online, polarDocker connects its peers and makes its default wallet.
- An LND node with a wallet that stays locked, or with no wallet, gets the `Error` status. Polar v4.0.0 has no Locked status.
- A litd node gets the LND check of its lnd daemon. Polar also waits for the lit sub-servers, so polarln can show `Started` before Polar does.
- A tapd, c-lightning, or eclair node gets `Started` if its container runs after the Lightning nodes are online. Polar uses an RPC check for these nodes.
- The wait for a bitcoind, LND, or litd node stops after 2 minutes. Then the node gets the `Error` status.

As in Polar, `startNetwork` returns after the nodes are online. It mines 1 block and connects the LND and litd nodes to each other.

A start writes the networks file a maximum of 3 times:

1. If a port moves: the network with the new ports and the old statuses.
2. After the containers start: the `Started` status.
3. After the wait for the nodes: the status of each node.

A failure after the checks writes the `Error` status. A check that refuses changes nothing.

## Differences from the Polar app

Waits:

- `startNode`, `restartNode`, and `renameNode` return after the nodes are online. Polar returns before the nodes are online.
- `addNode` also waits if the network is started. Polar returns before the node is online.
- `setLightningBackend` waits for its LND node if the network is started. Polar also waits, for all Lightning and bitcoind nodes of the network.
- `depositFunds` returns after the LND wallet shows the coins as confirmed. Polar waits 1 s.
- `openChannel` returns after the 2 nodes can use the channel for payments. Polar waits 1 s, and the first payment can fail.
- `closeChannel` waits for the transaction that closes the channel, and rejects if lnd cannot close the channel. Polar does not wait for lnd, and does not reject.

Compose files and ports:

- As in Polar, a start uses the compose file of the network. It writes a new compose file only if the file is not there or a port moves.
- A port moves only on a network with only bitcoind and LND nodes and no other services. Else a busy port gives `409 PolarPortInUse` or `409 ComposeFileHasOtherServices`.
- A container of the network that runs keeps its ports.
- On a network where no port can move, `startNode` and `restartNode` check only the ports of their node. Polar moves the busy ports of all stopped nodes.
- `restartNode` checks the start before the stop, so a refusal does not stop the node.

The `docker compose` command:

- As in Polar, `docker compose` runs in the network folder with no `-f` option. Thus it also reads an override file, for example `docker-compose.override.yml`.
- The `-p` option gives the project name. polarln removes `COMPOSE_PROJECT_NAME` and `COMPOSE_FILE` from the environment of the command. Thus these variables cannot change the project or the compose file.
- A network folder with no compose file gives an error, because `docker compose` then uses a file of a parent folder.
- As in Polar, `stopNetwork` runs `docker compose down`. A container that the compose file does not have stays.

Statuses and containers:

- `stopNode` also accepts a node with the `Error` status. Polar accepts only `Started` nodes. For other statuses, the error message stays `Only Started nodes can be stopped.`, as in Polar.
- `deleteNetwork` stops the network first if a status is not `Stopped`, also a tapd status, or if a container of the network runs. Polar does not look at the tapd statuses or at the containers.
- `renameNode` stops the network if a container of the network runs. It starts the network again if the node or the network was started. Polar stops and starts the network only if the node was started.
- `deleteNetwork` and `renameNode` look for the containers of the network (`docker ps`), also for a stopped network. Thus they need Docker. Without Docker, they give `503 DockerNotAvailable`.
- A start or a stop first checks that polarDocker can write the networks file. A check that refuses writes no status and runs no Docker command.

The same as in Polar:

- `setAutoMineMode` does not mine blocks. polarDocker writes the mode to the networks file. With the bridge, Polar sets the mode only in its memory. See [`set-auto-mine-mode`](commands/set-auto-mine-mode.md).
- `restartNode` only starts a node with the `Error` status.
