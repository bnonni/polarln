# polarln

TypeScript client methods for [Polar Lightning](https://lightningpolar.com/). Use them, or the `polarln` command, to control Polar regtest networks from scripts, tests, and a shell. Use `getNodeCredentials` to connect [`lightning`](https://github.com/alexbosworth/lightning), [`tapass`](https://github.com/bnonni/tapass), and [`litterm`](https://github.com/bnonni/litterm) to Polar nodes.

polarln sends requests to the HTTP bridge of the Polar v4 desktop app. It does not start Docker containers itself.

## Requirements

- Polar v4.0.0 or later. The Polar app must run. The bridge listens on `http://localhost:37373`.
- Node.js 22.12 or later.

polarln does not work in CI without a desktop session. For CI, use a Docker Compose regtest network.

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

## CLI

The `polarln` command runs each Polar bridge tool from a shell. Each tool is a command, and each tool argument is a flag. Install it with `npm install -g polarln`, or run it with `npx polarln`:

```sh
polarln list-networks
polarln open-channel --network-id 4 --from-node alice --to-node bob --sats 250000
polarln mine-blocks --network-id 4 --blocks 6
polarln get-node-credentials --network-id 4 --node-name bob
```

The bridge runs each tool in the Polar app, so the Polar app shows the change.

A change that you make directly on a node (for example with `lncli` or `bitcoin-cli`) does not always show in the Polar app:

- New blocks and on-chain balances do not show. To refresh the block height, the balances, and the channel counts, run `polarln mine-blocks --network-id 4 --blocks 1`. This command mines 1 block.
- New and closed channels show. But Polar syncs the chart one time per 5 seconds at most. Thus, if you mine less than 5 seconds after a direct open or close, the chart can keep a dashed line.
- Channel balances after a direct payment do not show until the next chart sync. The `open-channel`, `close-channel`, and `pay-invoice` commands sync the chart.

- Run `polarln --help` to see all commands. The command list comes from the running Polar app, so a new Polar tool is also a new command.
- Run `polarln <command> --help` to see the flags of a command.
- A boolean flag has no value: `--is-private`. Use `--no-auto-fund` for false.
- An array flag takes JSON: `--nodes '[{"implementation": "litd", "count": 2}]'`.
- Use `--url` to set a different bridge URL.

The result goes to stdout as JSON. An error goes to stderr as one JSON line: `[code, message, details]`. The exit code is 0 for success, 1 for a failed command, and 2 for a usage error.

The usage errors are `UnknownCommand`, `ExpectedCommandBeforeFlags`, `InvalidFlags`, `MissingRequiredFlags`, `ExpectedNumberForFlag`, `ExpectedJsonForFlag`, and `ExpectedAllowedValueForFlag`.

## Methods

Each method has the name of its Polar tool in camelCase. It sends its arguments (except `polar`) to the tool and returns the Polar result unchanged.

- Bridge: `polarBridge`, `listTools`, `getNodeCredentials`
- Networks: `createNetwork`, `deleteNetwork`, `exportNetworkToZip`, `importNetworkFromZip`, `listNetworks`, `renameNetwork`, `startNetwork`, `stopNetwork`
- Nodes: `addNode`, `getDefaultNodeCommand`, `listNodeVersions`, `removeNode`, `renameNode`, `restartNode`, `setLightningBackend`, `setTapBackend`, `startNode`, `stopNode`, `updateNodeCommand`
- Bitcoin: `getBitcoinWalletInfo`, `getBlockchainInfo`, `getNewBitcoinAddress`, `mineBlocks`, `sendBitcoin`, `setAutoMineMode`
- Lightning: `closeChannel`, `createInvoice`, `depositFunds`, `getNodeInfo`, `getWalletBalance`, `listChannels`, `openChannel`, `payInvoice`
- Taproot Assets: `closeTapChannel`, `createAssetInvoice`, `decodeTapAddress`, `fundTapChannel`, `getAssetsInChannels`, `getTapAddress`, `getTapBalances`, `listTapAssets`, `mintTapAsset`, `payAssetInvoice`, `sendTapAsset`, `syncTapUniverse`
- litd: `addLitdSession`, `listLitdSessions`, `revokeLitdSession`

Some method names are also in `lightning` (for example `openChannel`). If you import from both packages, use `import * as polarln from 'polarln'`.

## Errors

Methods reject with `[code, message, details]`. Polar sends each tool error as an HTTP 500 with a message. polarln maps the message to a code:

| Code | Message                         | Cause                                               |
| ---- | ------------------------------- | --------------------------------------------------- |
| 400  | `ExpectedPolarBridge`           | The `polar` argument is missing.                    |
| 400  | `PolarRejectedArguments`        | Polar rejected an argument.                         |
| 404  | `PolarNetworkNotFound`          | The network does not exist.                         |
| 404  | `PolarNodeNotFound`             | The node does not exist.                            |
| 404  | `PolarObjectNotFound`           | Another object (for example a file) does not exist. |
| 501  | `PolarToolNotSupported`         | This Polar version does not have the tool.          |
| 503  | `FailedToConnectToPolarBridge`  | The Polar app does not run, or the port is wrong.   |
| 503  | `PolarToolFailed`               | Polar or a node returned another error.             |
| 503  | `UnexpectedPolarBridgeResponse` | The response is not a Polar bridge response.        |
| 504  | `PolarToolTimedOut`             | The tool took more than 30 seconds.                 |

`details.err` has the Polar message.

## Polar versions

The bridge port comes from the `POLAR_MCP_PORT` environment variable, the same as in Polar. You can also give a URL: `polarBridge({url: 'http://localhost:40000'})`.

To find changes in a new Polar version, start Polar and run:

```sh
pnpm check-tools
```

The script compares the live tools with `test/fixtures/tools.json`.

## Development

```sh
pnpm install
pnpm lint
pnpm test
pnpm build
```

## License

[Unlicense](LICENSE). The types in `src/typescript` and `src/polar_methods` come from [jamaljsr/polar](https://github.com/jamaljsr/polar) (MIT). See [NOTICE](NOTICE).
