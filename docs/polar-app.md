# Polar app

The Polar app and polarln can use the same networks. This page shows how polarln keeps the files of the Polar app safe, and what the app shows after a change.

## Polar app check

The Polar app reads the networks file one time at its start, and it writes all of its networks at each save. Thus the app loses a change to the Polar files while it runs, or the change breaks the app.

In the Polar home, each Docker tool that can change files or containers first checks that the Polar app does not run. In a different data folder, the check does not run. For the data folders, see [Data folder](docker-backend.md#data-folder).

The check has 2 steps:

1. A `GET /health` request to the Polar bridge at `http://localhost:<port>`, with a timeout of 1.5 s. The port is `POLAR_MCP_PORT`, else 37373. The bridge of the app answers with the service `polar-mcp-bridge`.
2. If the bridge refuses the connect, a scan for a Polar process. On Linux, the scan reads the process names in `/proc` and looks for `polar`. On macOS, it runs `ps` and looks for `Polar` (not tested on a Mac).

The results:

- If the app runs, the tool gives `409 PolarAppIsRunning`. The details have `found: 'bridge'` and the bridge `url`, or `found: 'process'` and the process `pid`.
- If the check has no clear result, the tool gives `503 FailedToCheckPolarApp`. Examples are a timeout, a different program on the bridge port, a PID namespace, and Windows.
- There is no option to turn off the check.

In a PID namespace, for example in a Docker container or an LXD guest, the scan cannot see the processes of the host. Thus, if the bridge refuses the connect, each change to the Polar home gives `503 FailedToCheckPolarApp`. In a PID namespace and in CI, use a different data folder, for example `POLARLN_DATA_DIR=/tmp/polarln`.

### Tools with no check

These 16 tools do not check, because they do not change files or containers. They read files, or they use the RPC of the nodes:

- Network and node tools: `getDefaultNodeCommand`, `listNetworks`, and `listNodeVersions`.
- Bitcoin tools: `getBitcoinWalletInfo`, `getBlockchainInfo`, `getNewBitcoinAddress`, `mineBlocks`, and `sendBitcoin`.
- Lightning tools: `closeChannel`, `createInvoice`, `depositFunds`, `getNodeInfo`, `getWalletBalance`, `listChannels`, `openChannel`, and `payInvoice`.

On Docker, these tools also run while the Polar app runs. Some of them change the nodes directly, as `lncli` and `bitcoin-cli` do. An example is `mineBlocks`. For what the app then shows, see [Changes outside polarln](#changes-outside-polarln).

`getNodeCredentials` does not check either. It uses `listNetworks`, and it reads the node files.

The other 14 Docker tools check: `addNode`, `createNetwork`, `deleteNetwork`, `removeNode`, `renameNetwork`, `renameNode`, `restartNode`, `setAutoMineMode`, `setLightningBackend`, `startNetwork`, `startNode`, `stopNetwork`, `stopNode`, and `updateNodeCommand`. A new tool gets the check.

### Checks during a tool

The app can start while a long tool runs, for example during a start of 2 minutes. Thus a second check runs before each write of the networks file. `deleteNetwork` and `renameNode` also check before they delete or move a folder.

The `stage` detail of `PolarAppIsRunning` shows the check that refused:

| `stage`         | The check runs                                                                                              | Changes done before the refusal                      |
| --------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `before-tool`   | Before the tool                                                                                             | None.                                                |
| `before-delete` | `deleteNetwork`: before the delete of the network folder. `renameNode`: before the move of the node folder. | The stop of the network, if the network ran.         |
| `before-save`   | Before a write of the networks file                                                                         | The steps of the tool before that write (see below). |

The changes that a tool makes before a `before-save` refusal:

- `createNetwork`, `renameNetwork`, `setAutoMineMode`, and `updateNodeCommand`: none. The first write comes before the other changes.
- `startNetwork` and `startNode`: a new compose file, the volume folders, the containers that run, and the startup steps. The startup steps are the wallets, 1 block, and the peer connections. If a port moves, the first write comes before these steps.
- `restartNode`: the stop of the node, and the steps of `startNode`.
- `stopNetwork` and `stopNode`: the stop of the containers of the network, or of the node. `stopNetwork` also removes the containers.
- `deleteNetwork`: the stop of the network. The delete of the network folder comes after the check, with the write.
- `addNode`: on a started network, the new node in the networks file, the new compose file, and the container of the new node.
- `removeNode`: the removed container of the node. The new compose file comes after the check, with the write. For a bitcoind node of a started network: the stop of the network, then the new compose file and the start.
- `renameNode`: the stop of the network. The move of the node folder, the delete of the LND TLS files, and the new compose file come after the check, with the write. At a write of the start after the rename: the rename, and the steps of `startNetwork`.
- `setLightningBackend`: on a started network, the stop of the node, the new backend in the networks file, the new compose file, and the start of the node.

A different error at a write, for example `409 NetworksFileBusy` or `503 FailedToReadNetworksFile`, can occur after the same changes.

If a start gets `PolarAppIsRunning` with the stage `before-save`, the containers can run, but the file keeps the old statuses. To repair this, do one of these steps:

- Stop the network in the Polar app.
- Quit the app, and stop the network with polarln.

## Polar app and polarln

- polarln does not change the Polar files while the app runs. Use the bridge, or quit the app.
- With the bridge, the Polar app runs each tool, so the Polar app shows the change. One exception: after `add-node`, the chart shows no channel lines until the next chart sync.
- After polarln starts a network in the Polar home, the file shows the network as `Started`. If you then open the app, the app also shows the network as `Started`. But the app does not get the channel events of this network, so the chart can show old channels. To get the channel events, stop the network and start it in the app.
- When the app quits, it stops each started network. This includes a network that polarln started, because the compose project is the same.
- The app does not check Docker at its start. After an app crash, the file can show `Started` for a network that does not run. `startNetwork` or `stopNetwork` with polarln repairs the status.
- New nodes in the Polar home get the Polar defaults: the base ports and the node versions of Polar v4.0.0. polarDocker does not read the Polar settings (`settings.json` and `nodes.json`), and it does not write them.

## Changes outside polarln

A change that you make directly on a node does not always show in the Polar app. Examples of such a change are the commands of `lncli`, `bitcoin-cli`, and `tapcli`. If the app runs, the CLI uses the bridge, so the commands below go to the app. See [Backends](cli.md#backends).

- New blocks, on-chain balances, and tapd assets do not show. To refresh them, run `polarln mine-blocks --network-id 1 --blocks 1`. This command mines 1 block.
- Some read commands refresh the Polar app without a new block. `get-blockchain-info` refreshes the block height, and `get-tap-balances` refreshes the assets of a tapd node.
- New and closed channels show. But Polar syncs the chart one time per 5 seconds at most. Thus, if you mine less than 5 seconds after a direct open or close, the chart can keep a dashed line.
- Channel balances after a direct payment do not show until the next chart sync. The `open-channel`, `close-channel`, and `pay-invoice` commands sync the chart.

## Bridge port and Polar versions

The bridge port comes from the `POLAR_MCP_PORT` environment variable, the same as in Polar. The default port is 37373. These parts of polarln use the same port:

- The default URL of `polarBridge`.
- The Polar app check of the Docker backend.
- The auto backend of the CLI.

To give a different URL in code, use the `url` option: `polarBridge({url: 'http://localhost:40000'})`. In the CLI, use the `--url` flag. See [Global flags](cli.md#global-flags).

If the app uses a different port, set `POLAR_MCP_PORT` to the port of the app. Else, the CLI auto backend gives `409 PolarAppRunsWithoutBridge`. The Docker backend gives `409 PolarAppIsRunning` with `found: 'process'`.

The Polar versions:

- The bridge backend needs Polar v4.0.0 or later.
- The CLI has the tool schemas of Polar v4.0.0 (`src/polar_cli/bundled_tools.ts`). With the bridge, the command list comes from the Polar app.
- The Docker backend uses the Polar v4.0.0 formats: the networks file, the compose templates, the node versions, and the base ports.
- A networks file with a different version gives `501 PolarToolNotSupported` for each Docker tool that changes files or containers. The read tools still work.

To compare the tools of a new Polar version with the bundled schemas, see [New Polar version](CONTRIBUTING.md#new-polar-version).
