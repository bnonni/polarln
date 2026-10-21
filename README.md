# polarln

[![npm](https://img.shields.io/npm/v/polarln)](https://www.npmjs.com/package/polarln)
[![CI](https://github.com/bnonni/polarln/actions/workflows/ci.yml/badge.svg)](https://github.com/bnonni/polarln/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Polar Lightning client methods, CLI, and node credentials, over the Polar v4 HTTP bridge or on Docker

polarln gives TypeScript methods and a `polarln` command for [Polar Lightning](https://lightningpolar.com/) regtest networks. Use them to control Polar networks from scripts, tests, and a shell. Each Polar tool is a method and a command, for example `openChannel` and `polarln open-channel`. Use `getNodeCredentials` to connect [`lightning`](https://github.com/alexbosworth/lightning), [`tapass`](https://github.com/bnonni/tapass), and [`litterm`](https://github.com/bnonni/litterm) to Polar nodes. The tools run in the Polar desktop app, or on Docker without the app.

## Table of Contents

- [Background](#background)
- [Install](#install)
  - [Dependencies](#dependencies)
- [Usage](#usage)
  - [CLI](#cli)
  - [SDK](#sdk)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## Background

[Polar](https://github.com/jamaljsr/polar) is a desktop app that runs Lightning regtest networks on Docker. Polar v4 also serves its MCP tools on a local HTTP bridge. polarln calls these tools from code and from a shell, so scripts and tests can make and change Polar networks.

polarln has 2 backends:

- `polarBridge` sends each tool call to the HTTP bridge of the Polar v4 app. The Polar app must run.
- `polarDocker` (preview) runs the tools on Docker, without the Polar app. It has 30 of the 48 Polar tools: the Bitcoin tools, the Lightning tools without Taproot Assets, and the network and node tools except `import-network-from-zip`, `export-network-to-zip`, and `set-tap-backend`.

In code, you select the backend. The `polarln` CLI selects the backend for each command. If the Polar app answers, the CLI uses the bridge. If the Polar app does not run, the CLI runs the command on Docker, with the networks of the Polar app. On Docker, 31 of the 49 commands work, and the other commands give `501`.

polarln does not change the Polar files while the Polar app runs. See [Backends](docs/cli.md#backends) and [Polar app check](docs/polar-app.md#polar-app-check).

## Install

```sh
pnpm add -D polarln
```

To use the `polarln` command in a shell, install it globally, or run it with `npx`:

```sh
npm install -g polarln
npx polarln --help
```

The Docker backend and the `auto` CLI backend need polarln 0.2.0 or later. Version 0.1.0 uses only the bridge. See the [changelog](CHANGELOG.md).

### Dependencies

- Node.js 22.12 or later.
- For the bridge backend: Polar v4.0.0 or later. The Polar app must run. The bridge listens on `http://localhost:37373`, or on the port in `POLAR_MCP_PORT`.
- For the Docker backend: Docker with Docker Compose v2. The Polar app is not necessary. To change the networks of the Polar app, the app must not run.

The Polar bridge does not work in CI without a desktop session. In CI, use the Docker backend with a data folder that is not the Polar home, for example `POLARLN_DATA_DIR=/tmp/polarln`. A different folder gets the `polarln` container names, and the Polar app check does not run.

The Polar app check also scans the processes. In a PID namespace, for example in a Docker container or an LXD guest, this scan cannot see the processes of the host. Thus, if the bridge refuses the connect, each change to the Polar home gives `503 FailedToCheckPolarApp`.

## Usage

### CLI

Each Polar tool is a command, and each tool argument is a flag:

```sh
polarln list-networks
polarln create-network --name test
polarln start-network --network-id 1
polarln open-channel --network-id 1 --from-node alice --to-node bob \
  --sats 250000
polarln mine-blocks --network-id 1 --blocks 6
polarln get-node-credentials --network-id 1 --node-name bob
```

A new network with no `--nodes` flag has 2 LND nodes (`alice` and `bob`) and 1 bitcoind node. The example uses network 1. Use the `id` from the `create-network` result.

- Run `polarln --help` to see all commands and the selected backend.
- Run `polarln <command> --help` to see the flags of a command.
- The result goes to stdout as JSON. An error goes to stderr as one JSON line.

For the flags, the backends, and the exit codes, see [CLI](docs/cli.md). Each command has a page in the [command reference](docs/commands/README.md).

### SDK

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

In this example, network 4 has a started litd node `bob`. LND nodes give `lnd`, tapd nodes give `tapd`, and litd nodes give `litd`, `lnd`, and `tapd`. To run the same code without the Polar app, use `polarDocker()` in place of `polarBridge({})`.

For all methods, see [SDK](docs/sdk.md).

## Documentation

| Page                                         | Content                                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [Docs index](docs/README.md)                 | The list of all docs pages.                                                                                   |
| [CLI](docs/cli.md)                           | Install, flag syntax, global flags, backends, help, output, exit codes, and usage errors.                     |
| [Command reference](docs/commands/README.md) | One page for each of the 49 commands, with the flags, the backends, and an example.                           |
| [SDK](docs/sdk.md)                           | Backends, methods, `getNodeCredentials`, and `listTools`.                                                     |
| [Docker backend](docs/docker-backend.md)     | `polarDocker`, the data folder, the networks file, node kinds, and differences from Polar.                    |
| [Polar app](docs/polar-app.md)               | The Polar app check, the Polar app and polarln, changes outside polarln, the bridge port, and Polar versions. |
| [Errors](docs/errors.md)                     | The error format and each error code.                                                                         |
| [Contributing](docs/CONTRIBUTING.md)         | Development, tests, Docker checks, new Polar versions, docs, and commits.                                     |
| [Roadmap](ROADMAP.md)                        | The planned work.                                                                                             |
| [Changelog](CHANGELOG.md)                    | The changes of each release.                                                                                  |

## Contributing

To ask a question or to report a bug, open an issue at [github.com/bnonni/polarln/issues](https://github.com/bnonni/polarln/issues). Before you open a pull request, read [CONTRIBUTING](docs/CONTRIBUTING.md). It has the development steps, the test rules, the docs rules, and the commit rules.

## License

[MIT](LICENSE). Polar and lnd also use the MIT License. The code in `src/typescript`, `src/polar_methods`, and `src/polar_docker` comes from [jamaljsr/polar](https://github.com/jamaljsr/polar) (MIT). The Polar home rule and the bridge rules in `src/polar_app`, and the tool schemas in `src/polar_cli/bundled_tools.ts`, also come from Polar. The protos in `protos/lnrpc` come from [lnd](https://github.com/lightningnetwork/lnd) (MIT). See [NOTICE](NOTICE).
