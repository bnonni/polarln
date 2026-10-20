# polarln

TypeScript client methods for [Polar Lightning](https://lightningpolar.com/). Use them, or the `polarln` command, to control Polar regtest networks from scripts, tests, and a shell. Use `getNodeCredentials` to connect [`lightning`](https://github.com/alexbosworth/lightning), [`tapass`](https://github.com/bnonni/tapass), and [`litterm`](https://github.com/bnonni/litterm) to Polar nodes.

By default, polarln sends requests to the HTTP bridge of the Polar v4 desktop app. The `polarDocker` backend (preview) runs some tools on Docker, without the Polar app. See [Docker backend](#docker-backend-preview).

## Requirements

- Polar v4.0.0 or later. The Polar app must run. The bridge listens on `http://localhost:37373`.
- Node.js 22.12 or later.
- For the Docker backend: Docker with Docker Compose v2. The Polar app is not necessary.

The Polar bridge does not work in CI without a desktop session.

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

`polarDocker` runs the Polar tools on Docker, without the Polar app. It uses the Polar Docker images and the Polar v4.0.0 compose templates. The methods are the same for the two backends.

```ts
import {createNetwork, polarDocker, startNetwork} from 'polarln';

// The data is in ~/.polarln, or in $POLARLN_DATA_DIR
const {polar} = polarDocker();

const {network} = await createNetwork({polar, name: 'test'});

await startNetwork({polar, networkId: network.id});
```

The preview supports bitcoind and LND nodes, and these tools:

- Network tools: `createNetwork`, `deleteNetwork`, `listNetworks`, `renameNetwork`, `startNetwork`, and `stopNetwork`.
- Node tools: `addNode`, `getDefaultNodeCommand`, `listNodeVersions`, `removeNode`, `renameNode`, `restartNode`, `setLightningBackend`, `startNode`, `stopNode`, and `updateNodeCommand`.
- Bitcoin tools: `getBitcoinWalletInfo`, `getBlockchainInfo`, `getNewBitcoinAddress`, `mineBlocks`, `sendBitcoin`, and `setAutoMineMode`.
- Lightning tools: `closeChannel`, `createInvoice`, `depositFunds`, `getNodeInfo`, `getWalletBalance`, `listChannels`, `openChannel`, and `payInvoice`.

The tapd and litd tools, and the import and export tools, reject with `501`. The CLI uses only the bridge.

Differences from the Polar app:

- The container names are `polarln-n<id>-<name>`, so they do not clash with the Polar containers.
- The networks file is `networks/networks.json` in the data directory. The statuses are labels, such as `Started`, as in the bridge results.
- `startNode`, `restartNode`, and `renameNode` return after the nodes are online. `addNode` and `setLightningBackend` also wait if the network is started. Polar returns before the nodes are online.
- `stopNetwork` also removes the containers of removed and renamed nodes.
- `depositFunds` returns after the LND wallet shows the coins as confirmed. Polar waits 1 s.
- `openChannel` returns after the 2 nodes can use the channel for payments. Polar waits 1 s, and the first payment can fail.
- `closeChannel` waits for the closing transaction, and rejects if lnd cannot close the channel. Polar does not wait for lnd, and does not reject.

As in the Polar bridge, `setAutoMineMode` only saves the mode. It does not mine blocks.

As in Polar, `startNetwork` returns after the nodes are online. It mines 1 block and connects the LND nodes to each other.

## CLI

The `polarln` command runs each Polar bridge tool from a shell. Each tool is a command, and each tool argument is a flag. Install it with `npm install -g polarln`, or run it with `npx polarln`:

```sh
polarln list-networks
polarln open-channel --network-id 4 --from-node alice --to-node bob --sats 250000
polarln mine-blocks --network-id 4 --blocks 6
polarln get-node-credentials --network-id 4 --node-name bob
```

The bridge runs each tool in the Polar app, so the Polar app shows the change. One exception: after `add-node`, the chart shows no channel lines until the next chart sync.

- Run `polarln --help` to see all commands. The command list comes from the running Polar app, so a new Polar tool is also a new command.
- Run `polarln <command> --help` to see the flags of a command.
- A boolean flag has no value: `--is-private`. Use `--no-auto-fund` for false.
- An array flag takes JSON: `--nodes '[{"implementation": "litd", "count": 2}]'`.
- Use `--url` to set a different bridge URL.

The result goes to stdout as JSON. An error goes to stderr as one JSON line: `[code, message, details]`. The exit code is 0 for success, 1 for a failed command, and 2 for a usage error.

The usage errors are `UnknownCommand`, `ExpectedCommandBeforeFlags`, `InvalidFlags`, `MissingRequiredFlags`, `ExpectedNumberForFlag`, `ExpectedJsonForFlag`, and `ExpectedAllowedValueForFlag`.

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

Some method names are also in `lightning` (for example `openChannel`). If you import from both packages, use `import * as polarln from 'polarln'`.

## Errors

Methods reject with `[code, message, details]`. Polar sends each tool error as an HTTP 500 with a message. polarln maps the message to a code:

| Code | Message                         | Cause                                                                                                          |
| ---- | ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 400  | `ExpectedPolarBridge`           | The `polar` argument is missing.                                                                               |
| 400  | `PolarRejectedArguments`        | Polar rejected an argument.                                                                                    |
| 404  | `PolarNetworkNotFound`          | The network does not exist.                                                                                    |
| 404  | `PolarNodeNotFound`             | The node does not exist.                                                                                       |
| 404  | `PolarObjectNotFound`           | Another object (for example a file) does not exist.                                                            |
| 501  | `PolarToolNotSupported`         | Polar or `polarDocker` does not have the tool, or `polarDocker` does not support the node type.                |
| 503  | `DockerNotAvailable`            | `polarDocker` cannot use Docker: Docker is not installed or does not run, or you cannot use the Docker socket. |
| 503  | `FailedToConnectToPolarBridge`  | The Polar app does not run, or the port is wrong.                                                              |
| 503  | `PolarToolFailed`               | Polar or a node returned another error.                                                                        |
| 503  | `UnexpectedPolarBridgeResponse` | The response is not a Polar bridge response.                                                                   |
| 504  | `PolarToolTimedOut`             | The tool took more than 30 seconds.                                                                            |

`details.err` has the Polar message.

## Polar versions

The bridge port comes from the `POLAR_MCP_PORT` environment variable, the same as in Polar. You can also give a URL: `polarBridge({url: 'http://localhost:40000'})`.

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

To test the Docker backend on Docker, run `pnpm check-docker`.

## License

[Unlicense](LICENSE). The code in `src/typescript`, `src/polar_methods`, and `src/polar_docker`, and the tool schemas in `src/polar_cli/bundled_tools.ts`, come from [jamaljsr/polar](https://github.com/jamaljsr/polar) (MIT). The protos in `protos/lnrpc` come from [lnd](https://github.com/lightningnetwork/lnd) (MIT). See [NOTICE](NOTICE).
