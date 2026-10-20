# polarln

TypeScript client methods for [Polar Lightning](https://lightningpolar.com/). Use them, or the `polarln` command, to control Polar regtest networks from scripts, tests, and a shell. Use `getNodeCredentials` to connect [`lightning`](https://github.com/alexbosworth/lightning), [`tapass`](https://github.com/bnonni/tapass), and [`litterm`](https://github.com/bnonni/litterm) to Polar nodes.

The `polarln` CLI uses the Polar desktop app if the app runs. If the app does not run, the CLI runs the same commands on Docker, with the networks of the Polar app. polarln never changes the Polar files while the app runs.

In code, you select the backend. `polarBridge` sends the tool calls to the HTTP bridge of the Polar v4 app. `polarDocker` (preview) runs the tools on Docker, without the Polar app. See [Docker backend](#docker-backend-preview) and [CLI backends](#cli-backends).

## Requirements

- Node.js 22.12 or later.
- For the bridge backend: Polar v4.0.0 or later. The Polar app must run. The bridge listens on `http://localhost:37373`, or on the port in `POLAR_MCP_PORT`.
- For the Docker backend: Docker with Docker Compose v2. The Polar app is not necessary. To change the networks of the Polar app, the app must not run.

The Polar bridge does not work in CI without a desktop session. In CI, use the Docker backend with a data folder that is not the Polar home, for example `POLARLN_DATA_DIR=/tmp/polarln`. A different folder gets the `polarln` container names, and the Polar app check does not run. The Polar app check also scans the processes. In a PID namespace, for example in a Docker container or an LXD guest, this scan cannot see the processes of the host. Thus, if the bridge refuses the connect, each change to the Polar home gives `503 FailedToCheckPolarApp`.

## Install

```sh
pnpm add -D polarln
```

## Example

```ts
import {authenticatedLitdGrpc, getTerminalInfo} from 'litterm';
import {authenticatedTapdGrpc} from 'tapass';
import {getNodeCredentials, mineBlocks, polarBridge} from 'polarln';

const {polar} = polarBridge({});

// Get the cert, macaroon, and socket of each daemon in litd node "bob"
const creds = await getNodeCredentials({polar, networkId: 4, nodeName: 'bob'});

const {tapd} = authenticatedTapdGrpc(creds.tapd!);
const {litd} = authenticatedLitdGrpc({...creds.litd!, tapd});

console.log(await getTerminalInfo({litd}));

await mineBlocks({blocks: 6, networkId: 4, polar});
```

`getNodeCredentials` gives:

| Node | Result                    |
| ---- | ------------------------- |
| LND  | `lnd`                     |
| tapd | `tapd`                    |
| litd | `litd`, `lnd`, and `tapd` |

Each value is `{cert, macaroon, socket}` with base64 files and a `localhost:<port>` socket. The node must be started. Other implementations reject with `400`.

## Docker backend (preview)

`polarDocker` runs the Polar tools on Docker, without the Polar app. It uses the Polar Docker images, the Polar v4.0.0 compose templates, and the Polar v4.0.0 networks file. The methods are the same for the two backends.

```ts
import {createNetwork, polarDocker, startNetwork} from 'polarln';

// The data folder is $POLARLN_DATA_DIR, else the Polar home
const {polar} = polarDocker();

const {network} = await createNetwork({polar, name: 'test'});

await startNetwork({polar, networkId: network.id});
```

With no `dataDir`, the tools use the networks of the Polar app. To keep test networks apart from the Polar networks, give a different folder: `polarDocker({dataDir: '/tmp/polarln-test'})`.

The backend has these tools:

- Network tools: `createNetwork`, `deleteNetwork`, `listNetworks`, `renameNetwork`, `startNetwork`, and `stopNetwork`.
- Node tools: `addNode`, `getDefaultNodeCommand`, `listNodeVersions`, `removeNode`, `renameNode`, `restartNode`, `setLightningBackend`, `startNode`, `stopNode`, and `updateNodeCommand`.
- Bitcoin tools: `getBitcoinWalletInfo`, `getBlockchainInfo`, `getNewBitcoinAddress`, `mineBlocks`, `sendBitcoin`, and `setAutoMineMode`.
- Lightning tools: `closeChannel`, `createInvoice`, `depositFunds`, `getNodeInfo`, `getWalletBalance`, `listChannels`, `openChannel`, and `payInvoice`.

The tapd and litd tools, and the import and export tools, reject with `501`. To use this backend in the CLI, see [CLI backends](#cli-backends).

### Data folder

The data folder is the `dataDir` argument, then `$POLARLN_DATA_DIR`, then the Polar home. The Polar home is the data folder of the Polar app: `~/.local/share/polar` if that folder exists, else `~/.polar`. This is the Polar rule. A `dataDir` that is one of these 2 folders, also through a symlink, is also the Polar home.

| Data folder        | Compose project        | Containers             | Polar app check |
| ------------------ | ---------------------- | ---------------------- | --------------- |
| The Polar home     | `polar-network-<id>`   | `polar-n<id>-<name>`   | Yes             |
| A different folder | `polarln-network-<id>` | `polarln-n<id>-<name>` | No              |

In the Polar home, the names are the same as in the Polar app. Thus the app can stop a network that polarln started, and polarln can stop a network that the app started.

In a different folder, the names contain only the network id. Thus 2 such folders cannot run networks with the same id at the same time. The second start gives `409 ContainerNameInUse`, and the containers of the first folder do not change.

### Networks file

The networks file is `networks/networks.json` in the data folder. polarDocker reads and writes only the Polar v4.0.0 format, in each data folder:

- The file has the Polar status numbers: 0 (Starting), 1 (Started), 2 (Stopping), 3 (Stopped), and 4 (Error). The results have the labels, such as `Started`, as in the bridge results.
- polarDocker sets only the final statuses 1, 3, and 4. The Starting and Stopping statuses stay in memory. `startNetwork` and `stopNetwork` accept each status, so they repair a status 0 or 2 that the Polar app left. `startNode`, `stopNode`, and `restartNode` do not accept a node with the status 0 or 2. They give `400 PolarRejectedArguments`. A tool that does not start or stop nodes keeps the statuses of the file, also a status 0 or 2.
- A write keeps the version, the charts, the key order, and the keys that polarDocker does not know. A save with no change gives the same bytes as a Polar save.
- A write keeps the chart of each changed network in sync with its nodes, so that the Polar app can open the network. The positions, the sizes, and the channel links of the other nodes stay. A rename keeps the position of the node.
- A new chart node gets the icon of a node of the same kind in the file. If there is no such node, it gets the icon path of the Polar v4.0.0 build.
- Before a tool changes files or containers, it checks that it can write the file. A file with a different version, or with a status that is not 0-4, gives `501` before any change.
- A write goes to a temporary file. The temporary file goes to the disk (fsync), and then a rename replaces the file. A compose file write uses the same steps. A lock folder (`networks/networks.json.lock`) makes the changes of 2 processes run one at a time.
- A read does not check Docker. `listNetworks` shows the statuses in the file.

### Node kinds

| Tools                                                                                                                                          | Node kinds                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `listNetworks`, `startNetwork`, `stopNetwork`, `deleteNetwork`, `renameNetwork`, `setAutoMineMode`, `startNode`, `stopNode`, and `restartNode` | All. `startNetwork`, `stopNetwork`, `deleteNetwork`, `startNode`, `stopNode`, and `restartNode` use the compose file of the network. Thus `startNetwork` and `stopNetwork` also start and stop a service that a user added, for example `electrs`. `listNetworks`, `renameNetwork`, and `setAutoMineMode` use only the networks file. |
| `getBitcoinWalletInfo`, `getBlockchainInfo`, `getNewBitcoinAddress`, `mineBlocks`, and `sendBitcoin`                                           | bitcoind, in a network with any node kinds. `getNewBitcoinAddress` also takes an LND or litd node.                                                                                                                                                                                                                                    |
| The 8 Lightning tools                                                                                                                          | LND and litd. A litd node uses its lnd daemon, as in Polar.                                                                                                                                                                                                                                                                           |
| `getNodeCredentials`                                                                                                                           | LND, litd, and tapd.                                                                                                                                                                                                                                                                                                                  |
| `createNetwork`, `listNodeVersions`, and `getDefaultNodeCommand`                                                                               | bitcoind and LND.                                                                                                                                                                                                                                                                                                                     |
| `addNode`, `removeNode`, `renameNode`, `updateNodeCommand`, and `setLightningBackend`                                                          | A network with only bitcoind and LND nodes, and with no other compose services. These tools write a new compose file. On a different network, they give `501` or `409 ComposeFileHasOtherServices` before any change.                                                                                                                 |

A Lightning tool on a c-lightning or eclair node gives `501`. A tapd node is not a Lightning node, so a Lightning tool on a tapd node gives `404`.

`startNetwork` and `startNode` wait for the nodes:

- bitcoind and LND nodes get the Polar checks.
- A litd node gets the LND check of its lnd daemon. Polar also waits for the lit sub-servers, so polarln can show Started before Polar does.
- A tapd, c-lightning, or eclair node gets Started if its container runs after the Lightning nodes are online. Polar uses an RPC check for these nodes.

### Polar app check

The Polar app reads the networks file one time at its start, and it writes all of its networks at each save. Thus a change to the Polar files while the app runs is lost, or it breaks the app.

In the Polar home, each tool that can change files or containers first checks that the Polar app does not run. The check has 2 steps:

1. A `GET /health` request to the Polar bridge at `http://localhost:<port>`, with a timeout of 1.5 s. The port is `POLAR_MCP_PORT`, else 37373.
2. If the bridge refuses the connect, a scan for a Polar process. On Linux, the scan reads `/proc`. On macOS, it runs `ps` (not tested on a Mac). In a PID namespace, for example in a container, the scan has no clear result.

If the app runs, the tool gives `409 PolarAppIsRunning`. If the check has no clear result, the tool gives `503 FailedToCheckPolarApp`. Examples are a timeout, a different program on the bridge port, a PID namespace, and Windows. There is no option to turn off the check. In a different data folder, the check does not run.

These 16 tools do not check, because they do not change files or containers:

- Network and node tools: `getDefaultNodeCommand`, `listNetworks`, and `listNodeVersions`.
- Bitcoin tools: `getBitcoinWalletInfo`, `getBlockchainInfo`, `getNewBitcoinAddress`, `mineBlocks`, and `sendBitcoin`.
- Lightning tools: `closeChannel`, `createInvoice`, `depositFunds`, `getNodeInfo`, `getWalletBalance`, `listChannels`, `openChannel`, and `payInvoice`.

A new tool gets the check.

The app can start while a long tool runs, for example during a start of 2 minutes. Thus a second check runs before each write of the networks file. `deleteNetwork` and `renameNode` also check before they delete or move a folder. The `stage` detail shows the check that refused:

| `stage`         | The check runs                                                                                        | Steps that can be in effect                          |
| --------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `before-tool`   | Before the tool                                                                                       | None.                                                |
| `before-delete` | `deleteNetwork`: before it deletes the network folder. `renameNode`: before it moves the node folder. | The stop of the network, if the network ran.         |
| `before-save`   | Before a write of the networks file                                                                   | The steps of the tool before that write (see below). |

The steps that can be in effect at a `before-save` refusal:

| Tool                                                                     | Steps                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createNetwork`, `renameNetwork`, `setAutoMineMode`, `updateNodeCommand` | None. The first write comes before the other changes.                                                                                                                                                                                        |
| `startNetwork`, `startNode`                                              | A new compose file, the volume folders, the containers that run, and the startup steps: the wallets, 1 block, and the peer connections. If a port moves, the first write comes before these steps.                                           |
| `restartNode`                                                            | The stop of the node, and the steps of `startNode`.                                                                                                                                                                                          |
| `stopNetwork`, `stopNode`                                                | The stop of the containers of the network, or of the node. `stopNetwork` also removes the containers.                                                                                                                                        |
| `deleteNetwork`                                                          | The stop of the network. The delete of the network folder comes after the check, with the write.                                                                                                                                             |
| `addNode`                                                                | On a started network: the new compose file and the container of the new node.                                                                                                                                                                |
| `removeNode`                                                             | The removed container of the node. The new compose file comes after the check, with the write. For a bitcoind node of a started network: the stop of the network, then the new compose file and the start.                                   |
| `renameNode`                                                             | The stop of the network. The move of the node folder, the delete of the LND TLS files, and the new compose file come after the check, with the write. At a write of the start after the rename: the rename, and the steps of `startNetwork`. |
| `setLightningBackend`                                                    | On a started network: the stop of the node, then the new compose file and the start of the node.                                                                                                                                             |

A different error at a write, for example `409 NetworksFileBusy` or `503 FailedToReadNetworksFile`, leaves the same steps in effect.

If a start gets `PolarAppIsRunning` with the stage `before-save`, the containers can run, but the file keeps the old statuses. Stop the network in the Polar app, or quit the app and stop the network with polarln.

### Differences from the Polar app

- `startNode`, `restartNode`, and `renameNode` return after the nodes are online. `addNode` and `setLightningBackend` also wait if the network is started. Polar returns before the nodes are online.
- As in Polar, a start uses the compose file of the network. It writes a new compose file only if the file is not there or a port moves. A port moves only on a network with only bitcoind and LND nodes and no other services. Else a busy port gives `409 PolarPortInUse` or `409 ComposeFileHasOtherServices`. The ports of the containers of the network that run do not move.
- On a network where no port can move, `startNode` and `restartNode` check only the ports of their node. Polar moves the busy ports of all stopped nodes. `restartNode` checks the start before the stop, so a refusal does not stop the node.
- As in Polar, `docker compose` runs in the network folder with no `-f` option. Thus it also reads an override file, for example `docker-compose.override.yml`. The `-p` option gives the project name, so `COMPOSE_PROJECT_NAME` cannot change the project. A network folder with no compose file gives an error, because `docker compose` then uses a file of a parent folder.
- As in Polar, `stopNetwork` runs `docker compose down`. A container that the compose file does not have stays.
- `stopNode` also accepts a node with the Error status. Polar accepts only Started nodes. For other statuses, the error message stays `Only Started nodes can be stopped.`, as in Polar.
- `deleteNetwork` stops the network first if a status is not Stopped, also a tapd status, or if a container of the network runs. Polar does not look at the tapd statuses or at the containers.
- `renameNode` stops the network if a container of the network runs. It starts the network again if the node or the network was started. Polar stops and starts the network only if the node was started.
- `deleteNetwork` and `renameNode` look for the containers of the network (`docker ps`), also for a stopped network. Thus they need Docker. Without Docker, they give `503 DockerNotAvailable`.
- A start or a stop first checks that the networks file can be written. A check that refuses saves no status and runs no Docker command.
- `depositFunds` returns after the LND wallet shows the coins as confirmed. Polar waits 1 s.
- `openChannel` returns after the 2 nodes can use the channel for payments. Polar waits 1 s, and the first payment can fail.
- `closeChannel` waits for the closing transaction, and rejects if lnd cannot close the channel. Polar does not wait for lnd, and does not reject.

As in the Polar bridge, `setAutoMineMode` only saves the mode. It does not mine blocks.

As in Polar, `startNetwork` returns after the nodes are online. It mines 1 block and connects the LND and litd nodes to each other.

### Polar app and polarln

- polarln does not change the Polar files while the app runs. Use the bridge, or quit the app.
- After polarln starts a network in the Polar home, the file shows the network as Started. If you then open the app, the app also shows the network as Started. But the app does not get the channel events of this network, so the chart can show old channels. To get the channel events, stop the network and start it in the app.
- When the app quits, it stops each started network. This includes a network that polarln started, because the compose project is the same.
- The app does not check Docker at its start. After an app crash, the file can show Started for a network that does not run. `startNetwork` or `stopNetwork` with polarln repairs the status.
- New nodes in the Polar home get the Polar defaults: the base ports and the node versions of Polar v4.0.0. polarDocker does not read the Polar settings (`settings.json` and `nodes.json`), and it does not write them.

## CLI

The `polarln` command runs each Polar tool from a shell. Each tool is a command, and each tool argument is a flag. Install it with `npm install -g polarln`, or run it with `npx polarln`:

```sh
polarln list-networks
polarln open-channel --network-id 4 --from-node alice --to-node bob --sats 250000
polarln mine-blocks --network-id 4 --blocks 6
polarln get-node-credentials --network-id 4 --node-name bob
```

With the bridge, the Polar app runs each tool, so the Polar app shows the change. One exception: after `add-node`, the chart shows no channel lines until the next chart sync.

- Run `polarln --help` to see all commands. With the bridge, the command list comes from the Polar app, so a new Polar tool is also a new command. With Docker, the list comes from the bundled Polar v4.0.0 tool schemas, and the help works without Docker.
- Run `polarln <command> --help` to see the flags of a command.
- A boolean flag has no value: `--is-private`. Use `--no-auto-fund` for false.
- An array flag takes JSON: `--nodes '[{"implementation": "litd", "count": 2}]'`.
- Use `--url` to set a different bridge URL. This flag also selects the bridge.
- Put the flags after the command: `polarln list-networks --backend docker`.

Line 3 of `polarln --help` shows the backend and the cause of the choice. Examples:

```text
Backend: bridge (auto: the Polar app answers at http://localhost:37373).
Backend: docker (auto: no Polar app at http://localhost:37373). Data folder: /home/u/.polar (the Polar home).
Backend: docker (auto: the Polar bridge does not answer at http://localhost:37373). Data folder: /home/u/.polar (the Polar home).
Backend: docker (--data-dir). Data folder: /tmp/x.
Backend: bridge (--backend). Bridge URL: http://localhost:37373.
```

The CLI shows the third example if the bridge refuses the connect and the scan for a Polar process has no clear result. Then a change to the Polar home gives `503 FailedToCheckPolarApp`.

The result goes to stdout as JSON. An error goes to stderr as one JSON line: `[code, message, details]`. The exit code is 0 for success, 1 for a failed command, and 2 for a usage error.

The usage errors are `UnknownCommand`, `ExpectedCommandBeforeFlags`, `InvalidFlags`, `MissingRequiredFlags`, `ExpectedNumberForFlag`, `ExpectedJsonForFlag`, `ExpectedAllowedValueForFlag`, `ExpectedAllowedValueForEnv`, and `UnexpectedFlagForBackend`.

### CLI backends

The CLI runs each command with one backend: the bridge or Docker. The default is `auto`.

| Setting     | Flag                               | Environment variable         | Default                  | Backend |
| ----------- | ---------------------------------- | ---------------------------- | ------------------------ | ------- |
| Backend     | `--backend <auto\|bridge\|docker>` | `POLARLN_BACKEND`            | `auto`                   | all     |
| Data folder | `--data-dir <path>`                | `POLARLN_DATA_DIR`           | The Polar home           | docker  |
| Bridge URL  | `--url <url>`                      | `POLAR_MCP_PORT` (port only) | `http://localhost:37373` | bridge  |

Auto selects the backend for each command, in this order:

1. `--url` selects the bridge. If the bridge does not answer, the command fails. There is no fallback to Docker.
2. `--data-dir` selects Docker. The CLI sends no request to the bridge.
3. `--url` together with `--data-dir` is the usage error `UnexpectedFlagForBackend`.
4. With neither flag, the CLI gets the tools of the bridge (`GET /api/mcp/tools`, with a timeout of 3 s). An answer selects the bridge.
5. If the bridge refuses the connect, the CLI looks for a Polar process. If a Polar process runs, the command fails with `409 PolarAppRunsWithoutBridge`. Else, the command runs on Docker, also if the scan has no clear result. Before each change to the Polar home, the Docker backend checks for the app again.
6. Each other bridge failure ends the command with exit code 1. There is no fallback to Docker. Examples are a timeout, an error answer such as `504`, a different server, and a bad URL. Such a failure does not prove that the app is off.

Under auto, a `--url` or `--data-dir` flag with an empty value or with no value is the same as no flag. Thus `--data-dir "$DIR"` with an empty `$DIR` does not select Docker. A command with a flag that has no value is still the usage error `InvalidFlags`.

`POLARLN_DATA_DIR` sets the Docker data folder, but it does not select Docker. `polarln --version` sends no request.

To run all commands of a shell on Docker, in a different data folder:

```sh
export POLARLN_BACKEND=docker
export POLARLN_DATA_DIR=/tmp/polarln-test
polarln create-network --name test
polarln start-network --network-id 1
polarln open-channel --network-id 1 --from-node alice --to-node bob --sats 250000
```

Rules:

- The flag comes before the environment variable. An empty `--backend` or `POLARLN_BACKEND` value is the same as no value.
- With `--backend bridge`, the `--data-dir` flag is a usage error. With `--backend docker`, the `--url` flag is a usage error.
- With Docker, the commands that `polarDocker` does not support show in a separate help list. These commands reject with `501`.
- If the Docker backend code cannot load, a docker command fails with `503 FailedToLoadDockerBackend`.
- The tools request to the bridge has a timeout of 3 s, also with `--backend bridge`. A timeout gives `503 FailedToConnectToPolarBridge`.

### Changes outside polarln

A change that you make directly on a node (for example with `lncli`, `bitcoin-cli`, or `tapcli`) does not always show in the Polar app:

- New blocks, on-chain balances, and tapd assets do not show. To refresh them, run `polarln mine-blocks --network-id 4 --blocks 1`. This command mines 1 block.
- Some read commands refresh the Polar app without a new block: `get-blockchain-info` refreshes the block height, and `get-tap-balances` refreshes the assets of a tapd node.
- New and closed channels show. But Polar syncs the chart one time per 5 seconds at most. Thus, if you mine less than 5 seconds after a direct open or close, the chart can keep a dashed line.
- Channel balances after a direct payment do not show until the next chart sync. The `open-channel`, `close-channel`, and `pay-invoice` commands sync the chart.

## Methods

Each method has the name of its Polar tool in camelCase. It sends its arguments (except `polar`) to the tool and returns the Polar result unchanged.

- Backends: `polarBridge`, `polarDocker`
- Bridge: `listTools`, `getNodeCredentials` (`getNodeCredentials` also works with `polarDocker`)
- Networks: `createNetwork`, `deleteNetwork`, `exportNetworkToZip`, `importNetworkFromZip`, `listNetworks`, `renameNetwork`, `startNetwork`, `stopNetwork`
- Nodes: `addNode`, `getDefaultNodeCommand`, `listNodeVersions`, `removeNode`, `renameNode`, `restartNode`, `setLightningBackend`, `setTapBackend`, `startNode`, `stopNode`, `updateNodeCommand`
- Bitcoin: `getBitcoinWalletInfo`, `getBlockchainInfo`, `getNewBitcoinAddress`, `mineBlocks`, `sendBitcoin`, `setAutoMineMode`
- Lightning: `closeChannel`, `createInvoice`, `depositFunds`, `getNodeInfo`, `getWalletBalance`, `listChannels`, `openChannel`, `payInvoice`
- Taproot Assets: `closeTapChannel`, `createAssetInvoice`, `decodeTapAddress`, `fundTapChannel`, `getAssetsInChannels`, `getTapAddress`, `getTapBalances`, `listTapAssets`, `mintTapAsset`, `payAssetInvoice`, `sendTapAsset`, `syncTapUniverse`
- litd: `addLitdSession`, `listLitdSessions`, `revokeLitdSession`

`listTools` takes an optional `timeout` in milliseconds. Some method names are also in `lightning` (for example `openChannel`). If you import from both packages, use `import * as polarln from 'polarln'`.

## Errors

Methods reject with `[code, message, details]`. Polar sends each tool error as an HTTP 500 with a message. polarln maps the message to a code:

| Code | Message                         | Cause                                                                                                                                         |
| ---- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 400  | `ExpectedPolarBridge`           | The `polar` argument is missing.                                                                                                              |
| 400  | `PolarRejectedArguments`        | Polar rejected an argument.                                                                                                                   |
| 404  | `PolarNetworkNotFound`          | The network does not exist.                                                                                                                   |
| 404  | `PolarNodeNotFound`             | The node does not exist.                                                                                                                      |
| 404  | `PolarObjectNotFound`           | Another object (for example a file) does not exist.                                                                                           |
| 501  | `PolarToolNotSupported`         | Polar or `polarDocker` does not have the tool. Or `polarDocker` does not support the node kind, the networks file version, or a status value. |
| 503  | `DockerNotAvailable`            | `polarDocker` cannot use Docker: Docker is not installed or does not run, or you cannot use the Docker socket.                                |
| 503  | `FailedToConnectToPolarBridge`  | The Polar app does not run, the port is wrong, or the bridge did not send the full answer before the timeout.                                 |
| 503  | `PolarToolFailed`               | Polar or a node returned another error.                                                                                                       |
| 503  | `UnexpectedPolarBridgeResponse` | The response is not a Polar bridge response.                                                                                                  |
| 504  | `PolarToolTimedOut`             | The tool took more than 30 seconds.                                                                                                           |

`details.err` has the Polar message.

The Docker backend and the CLI also give these errors:

| Code | Message                        | Cause                                                                                                                                                                                                                   | `details`                                 |
| ---- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 409  | `ComposeFileHasOtherServices`  | A tool must write a new compose file, but the file has a service that is not a node, for example `electrs`. A node with no service is not an error.                                                                     | `{networkId, path, services}`             |
| 409  | `ContainerNameInUse`           | A container with the compose project of the network, or with the name of a node, is not a container of the network folder. Examples are a container of a different data folder, and a container with no compose labels. | `{container, project, workingDir}`        |
| 409  | `NetworkPathOutsideDataFolder` | The networks file has a network folder that is not `<dataDir>/networks/<id>`, or a node file that is not in the network folder. A copy of a data folder has the paths of the original.                                  | `{expected, networkId, path}`             |
| 409  | `NetworksFileBusy`             | A different change holds the lock of the networks file for more than 3 s.                                                                                                                                               | `{dataDir}`                               |
| 409  | `PolarAppIsRunning`            | The Polar app runs, and the tool can change the Polar home.                                                                                                                                                             | `{dataDir, found, hint, pid\|url, stage}` |
| 409  | `PolarAppRunsWithoutBridge`    | CLI auto: the bridge refuses the connect, but a Polar process runs.                                                                                                                                                     | `{hint, pid, url}`                        |
| 409  | `PolarPortInUse`               | A port of a node that starts is in use. The network has a node kind that `polarDocker` cannot write to a compose file (tapd, litd, c-lightning, or eclair), so the port cannot move.                                    | `{node, port}`                            |
| 503  | `FailedToCheckPolarApp`        | The Polar app check has no clear result.                                                                                                                                                                                | `{dataDir, err}`                          |
| 503  | `FailedToLoadDockerBackend`    | The CLI cannot load the Docker backend code.                                                                                                                                                                            | `{err}`                                   |
| 503  | `FailedToReadNetworksFile`     | `polarDocker` cannot read the networks file. It does not write the file.                                                                                                                                                | `{err, path}`                             |

Notes:

- `services` of `ComposeFileHasOtherServices` lists only the services that are not nodes.
- `NetworkPathOutsideDataFolder` has 2 shapes. For a network folder, `expected` is `<dataDir>/networks/<id>`, and `path` is the network folder. For a node file, `expected` is the network folder, and `path` is the node file.
- `PolarAppIsRunning` has `found: 'bridge'` and the bridge `url`, or `found: 'process'` and the process `pid`. `hint` tells you what to do. For `stage`, see [Polar app check](#polar-app-check).
- `FailedToReadNetworksFile` has one of these `err` values: the JSON parse message, `The file has no networks array`, `A network has no node arrays, or a node is not an object`, `The charts key is not an object`, or `The networks file is not there, but the network folders are`. The last value occurs only in the Polar home.

## Polar versions

The bridge port comes from the `POLAR_MCP_PORT` environment variable, the same as in Polar. The Polar app check of the Docker backend and the auto backend of the CLI use the same port. You can also give a URL: `polarBridge({url: 'http://localhost:40000'})`.

To find changes in a new Polar version, start Polar and run:

```sh
pnpm check-tools
```

The script compares the live tools with `src/polar_cli/bundled_tools.ts`. To update the file, run `pnpm check-tools --write <version>`, for example `pnpm check-tools --write 4.1.0`.

## Development

```sh
pnpm install
pnpm lint
pnpm test
pnpm build
```

`pnpm test` starts `bun test` with a new temporary `HOME`. The tests also give an explicit temporary data folder or home folder, so no test uses the real Polar home.

To test the Docker backend on Docker, run `pnpm check-docker`. To test the CLI under Node.js, run `pnpm check-cli`. This script also checks the auto backend with a temporary home folder. The two scripts use temporary data folders and `polarln-*` container names.

## License

[Unlicense](LICENSE). The code in `src/typescript`, `src/polar_methods`, and `src/polar_docker` comes from [jamaljsr/polar](https://github.com/jamaljsr/polar) (MIT). The Polar home rule and the bridge rules in `src/polar_app`, and the tool schemas in `src/polar_cli/bundled_tools.ts`, also come from Polar. The protos in `protos/lnrpc` come from [lnd](https://github.com/lightningnetwork/lnd) (MIT). See [NOTICE](NOTICE).
