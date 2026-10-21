# SDK

polarln is a TypeScript library. Each Polar tool is a method. A method sends its arguments to a backend and returns the Polar result.

For the same tools in a shell, see [CLI](cli.md). For each tool, see the [command reference](commands/README.md).

## Install

```sh
pnpm add -D polarln
```

With npm: `npm install --save-dev polarln`.

`polarDocker`, the types `PolarBackend`, `PolarDocker`, and `PolarDockerArgs`, the `timeout` argument of `listTools`, and `getNodeCredentials` with `polarDocker` need polarln 0.2.0 or later. Version 0.1.0 uses only the bridge.

Requirements:

- Node.js 22.12 or later.
- For the bridge backend: Polar v4.0.0 or later. The Polar app must run.
- For the Docker backend: Docker with Docker Compose v2. The Polar app is not necessary.

The package is an ES module with TypeScript types.

## Backends

Each method takes a backend object in the `polar` argument. Make the object with `polarBridge` or `polarDocker`. Each of these functions returns `{polar}`. They send no request.

### polarBridge

`polarBridge` sends the tool calls to the HTTP bridge of the Polar v4 app. The Polar app runs each tool, so the Polar app shows the change.

```ts
import {listNetworks, polarBridge} from 'polarln';

const {polar} = polarBridge();

const {networks} = await listNetworks({polar});
```

| Argument | Default                   | Description                                                         |
| -------- | ------------------------- | ------------------------------------------------------------------- |
| `url`    | `http://localhost:<port>` | The base URL of the bridge. polarln removes the slashes at the end. |
| `fetch`  | The global `fetch`        | The fetch function for the requests.                                |

The default port is the value of `POLAR_MCP_PORT`, else 37373. Polar reads the same variable. `polarBridge` reads the variable when you call it. To use a different bridge, give a URL: `polarBridge({url: 'http://localhost:40000'})`. See [Bridge port and Polar versions](polar-app.md#bridge-port-and-polar-versions).

If the Polar app does not run, each method rejects with `503 FailedToConnectToPolarBridge`.

### polarDocker

`polarDocker` (preview) runs the Polar tools on Docker, without the Polar app. It uses the Polar Docker images, the Polar v4.0.0 compose templates, and the Polar v4.0.0 networks file. The methods are the same for the 2 backends.

```ts
import {createNetwork, polarDocker, startNetwork} from 'polarln';

// The data folder is $POLARLN_DATA_DIR, else the Polar home
const {polar} = polarDocker();

const {network} = await createNetwork({polar, name: 'test'});

await startNetwork({polar, networkId: network.id});
```

| Argument  | Default                                  | Description                      |
| --------- | ---------------------------------------- | -------------------------------- |
| `dataDir` | `$POLARLN_DATA_DIR`, else the Polar home | The folder of the networks file. |

The Polar home is the data folder of the Polar app: `~/.local/share/polar` if that folder exists, else `~/.polar`. With no `dataDir`, the tools use the networks of the Polar app. To keep test networks apart from the Polar networks, give a different folder: `polarDocker({dataDir: '/tmp/polarln-test'})`.

`polarDocker` makes the data folder an absolute path. The `polar.dataDir` value shows this path.

`polarDocker` does not load the Docker tool code. The first tool call loads it, with `@grpc/grpc-js` and `@grpc/proto-loader`. Thus an import of `polarln` does not load gRPC. If the tool code cannot load, each tool call rejects with `503 FailedToLoadDockerBackend`.

The Docker backend has 30 of the 48 Polar tools. The other tools reject with `501 PolarToolNotSupported`. In the Polar home, each tool that can change files or containers first checks that the Polar app does not run. For the details, see these pages:

- [Docker backend](docker-backend.md): the tools, the data folder, the networks file, and the node kinds.
- [Polar app check](polar-app.md#polar-app-check): when a tool refuses, because the Polar app runs.

## Methods

Each method has the name of its Polar tool in camelCase. For example, the tool `open_channel` is the method `openChannel`. The arguments are `polar` and the tool arguments, for example `networkId`.

A method sends the tool arguments to the backend with no change. It returns the Polar result with no change. The Docker backend returns plain JSON data with the shape of the bridge result.

Each name links to the page of its command:

- Networks: [`listNetworks`](commands/list-networks.md), [`createNetwork`](commands/create-network.md), [`importNetworkFromZip`](commands/import-network-from-zip.md), [`exportNetworkToZip`](commands/export-network-to-zip.md), [`startNetwork`](commands/start-network.md), [`stopNetwork`](commands/stop-network.md), [`deleteNetwork`](commands/delete-network.md), [`renameNetwork`](commands/rename-network.md)
- Nodes: [`setLightningBackend`](commands/set-lightning-backend.md), [`setTapBackend`](commands/set-tap-backend.md), [`updateNodeCommand`](commands/update-node-command.md), [`getDefaultNodeCommand`](commands/get-default-node-command.md), [`listNodeVersions`](commands/list-node-versions.md), [`addNode`](commands/add-node.md), [`startNode`](commands/start-node.md), [`restartNode`](commands/restart-node.md), [`stopNode`](commands/stop-node.md), [`removeNode`](commands/remove-node.md), [`renameNode`](commands/rename-node.md)
- Bitcoin: [`mineBlocks`](commands/mine-blocks.md), [`getBlockchainInfo`](commands/get-blockchain-info.md), [`getBitcoinWalletInfo`](commands/get-bitcoin-wallet-info.md), [`sendBitcoin`](commands/send-bitcoin.md), [`getNewBitcoinAddress`](commands/get-new-bitcoin-address.md), [`setAutoMineMode`](commands/set-auto-mine-mode.md)
- Lightning: [`openChannel`](commands/open-channel.md), [`closeChannel`](commands/close-channel.md), [`listChannels`](commands/list-channels.md), [`getNodeInfo`](commands/get-node-info.md), [`getWalletBalance`](commands/get-wallet-balance.md), [`depositFunds`](commands/deposit-funds.md), [`createInvoice`](commands/create-invoice.md), [`payInvoice`](commands/pay-invoice.md)
- Taproot Assets: [`closeTapChannel`](commands/close-tap-channel.md), [`fundTapChannel`](commands/fund-tap-channel.md), [`mintTapAsset`](commands/mint-tap-asset.md), [`listTapAssets`](commands/list-tap-assets.md), [`sendTapAsset`](commands/send-tap-asset.md), [`getTapBalances`](commands/get-tap-balances.md), [`getTapAddress`](commands/get-tap-address.md), [`decodeTapAddress`](commands/decode-tap-address.md), [`syncTapUniverse`](commands/sync-tap-universe.md), [`createAssetInvoice`](commands/create-asset-invoice.md), [`payAssetInvoice`](commands/pay-asset-invoice.md), [`getAssetsInChannels`](commands/get-assets-in-channels.md)
- litd: [`listLitdSessions`](commands/list-litd-sessions.md), [`addLitdSession`](commands/add-litd-session.md), [`revokeLitdSession`](commands/revoke-litd-session.md)

polarln also has these functions. They are not Polar tools:

- Backends: [`polarBridge`](#polarbridge) and [`polarDocker`](#polardocker).
- [`getNodeCredentials`](#getnodecredentials): the gRPC credentials of a node. It works with the 2 backends.
- [`listTools`](#listtools): the tools of the Polar bridge. It works only with `polarBridge`.

Each method has the types `<Method>Args` and `<Method>Result`, for example `OpenChannelArgs` and `OpenChannelResult`. `listNetworks` has only `ListNetworksResult`. The package also exports the types `PolarError`, `Network`, `PolarNode`, `Status`, `PolarBackend`, `PolarDocker`, and `PolarDockerArgs`.

The 48 tool methods have no timeout of their own. The Polar bridge stops the wait for a tool after 30 s. Then the method rejects with `504 PolarToolTimedOut`. For all errors, see [Errors](errors.md).

Some method names are also in [`lightning`](https://github.com/alexbosworth/lightning), for example `openChannel`. If you import from the 2 packages, use a namespace import:

```ts
import * as polarln from 'polarln';

const {polar} = polarln.polarBridge();

await polarln.openChannel({
  polar,
  networkId: 1,
  fromNode: 'alice',
  toNode: 'bob',
  sats: 250000,
});
```

## getNodeCredentials

`getNodeCredentials` gets the gRPC credentials of a Polar node. Use them to connect [`lightning`](https://github.com/alexbosworth/lightning), [`tapass`](https://github.com/bnonni/tapass), and [`litterm`](https://github.com/bnonni/litterm) to the node.

```ts
import {authenticatedLitdGrpc, getTerminalInfo} from 'litterm';
import {authenticatedTapdGrpc} from 'tapass';
import {getNodeCredentials, mineBlocks, polarBridge} from 'polarln';

const {polar} = polarBridge();

// Get the cert, macaroon, and socket of each daemon in litd node "bob"
const creds = await getNodeCredentials({polar, networkId: 1, nodeName: 'bob'});

const {tapd} = authenticatedTapdGrpc(creds.tapd!);
const {litd} = authenticatedLitdGrpc({...creds.litd!, tapd});

console.log(await getTerminalInfo({litd}));

await mineBlocks({blocks: 6, networkId: 1, polar});
```

The result has the `implementation` of the node, and a key for each daemon:

| Node | Result                    |
| ---- | ------------------------- |
| LND  | `lnd`                     |
| tapd | `tapd`                    |
| litd | `litd`, `lnd`, and `tapd` |

Each daemon value is `{cert, macaroon, socket}`. `cert` and `macaroon` are the base64 files. `socket` is `localhost:<port>`, because the Polar TLS certificates name `localhost`.

| Key                | `cert`            | `macaroon`                | Port of the socket |
| ------------------ | ----------------- | ------------------------- | ------------------ |
| `lnd`              | The lnd TLS cert  | The lnd admin macaroon    | The gRPC port      |
| `tapd` (tapd node) | The tapd TLS cert | The tapd admin macaroon   | The gRPC port      |
| `litd`             | The litd TLS cert | The litd macaroon         | The web port       |
| `tapd` (litd node) | The litd TLS cert | The tapd macaroon of litd | The web port       |

In litd integrated mode, the web port of litd also serves tapd. Give each value to the gRPC function of its package:

- `lnd`: `authenticatedLndGrpc` of `lightning`.
- `tapd`: `authenticatedTapdGrpc` of `tapass`.
- `litd`: `authenticatedLitdGrpc` of `litterm`.

Rules:

- The node must be started. A node that is not LND, litd, or tapd gives `400`.
- The method gets the node from `listNetworks`, and then it reads the files on the local disk. Thus use it on the computer of the Polar app or of the Docker data folder.
- With `polarDocker`, the method does not check the Polar app, because it does not change files or containers.

For the errors, see [getNodeCredentials errors](errors.md#getnodecredentials-errors). In a shell, use [`polarln get-node-credentials`](commands/get-node-credentials.md).

## listTools

`listTools` gets the tools of the Polar bridge (`GET /api/mcp/tools`). Use it to check that the Polar app runs.

```ts
import {listTools, polarBridge} from 'polarln';

const {polar} = polarBridge();

const {tools} = await listTools({polar, timeout: 3000});
```

Each tool has a `name` (for example `mine_blocks`), a `description`, and an `inputSchema` (the JSON Schema of the arguments). The method returns the answer of the bridge with no check.

`timeout` is optional. It is the maximum time in milliseconds for the connect, the headers, and the body. With no `timeout`, there is no limit. If the full answer does not come in time, the method rejects with `503 FailedToConnectToPolarBridge`. The CLI uses a timeout of 3 s for the same request.

`listTools` works only with `polarBridge`. A `polarDocker` object gives `400 ExpectedPolarBridge`.
