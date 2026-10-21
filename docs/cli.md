# CLI

The `polarln` command runs each Polar tool from a shell. Each tool is a command, and each tool argument is a flag. A command runs on the Polar app (the bridge backend) or on Docker (the Docker backend).

For the page of each command, see the [command reference](commands/README.md).

## Contents

- [Install and run](#install-and-run)
- [Commands and flags](#commands-and-flags)
- [Global flags](#global-flags)
- [Backends](#backends)
- [Help](#help)
- [Output and exit codes](#output-and-exit-codes)
- [Usage errors](#usage-errors)

## Install and run

Requirements:

- Node.js 22.12 or later.
- For the bridge backend: Polar v4.0.0 or later. The Polar app must run.
- For the Docker backend: Docker with Docker Compose v2. The Polar app is not necessary.

Install the command globally:

```sh
npm install -g polarln
```

Or run the command with no global install:

```sh
npx polarln list-networks
```

In a project that has `polarln` as a dependency, `npx polarln` and `pnpm exec polarln` run the local copy.

The Docker backend, the `auto` backend, the `--backend` and `--data-dir` flags, and the `POLARLN_BACKEND` and `POLARLN_DATA_DIR` environment variables need polarln 0.2.0 or later. Version 0.1.0 uses only the bridge.

Examples:

```sh
polarln list-networks
polarln open-channel --network-id 1 --from-node alice --to-node bob --sats 250000
polarln mine-blocks --network-id 1 --blocks 6
polarln get-node-credentials --network-id 1 --node-name bob
```

## Commands and flags

The command name is the Polar tool name in kebab case. The flag name is the tool argument name in kebab case.

| Polar name     | CLI name       |
| -------------- | -------------- |
| `open_channel` | `open-channel` |
| `networkId`    | `--network-id` |

With the bridge, the command list comes from the Polar app. Thus a new Polar tool is also a new command. With Docker, the command list comes from the bundled Polar v4.0.0 tool schemas.

polarln adds 1 command that is not a Polar tool: [`get-node-credentials`](commands/get-node-credentials.md). It works with the two backends.

Flag rules:

- Put the flags after the command: `polarln list-networks --backend docker`. A flag before the command gives `ExpectedCommandBeforeFlags`.
- A string or number flag takes a value: `--name test` or `--name=test`. If the value starts with `-`, use the `=` form: `--name=-x`.
- A boolean flag has no value: `--is-private` sets true. Each boolean flag also has a `--no-` form for false: `--no-auto-fund`.
- An array flag takes JSON: `--nodes '[{"implementation": "bitcoind"}, {"implementation": "LND", "count": 2}]'`. An object flag also takes JSON, but no bundled tool has an object flag now.
- A number flag takes a number. An `integer` flag takes only a whole number.
- Some flags take only values from a list. For example, `--mode` of `set-auto-mine-mode` takes `0`, `30`, `60`, `300`, or `600`.
- A command takes no positional arguments.

The help of a command shows the `--no-` form only if the default of the flag is not false. For example, it shows `--no-auto-fund`, but not `--no-is-private`.

## Global flags

All commands take these flags:

| Flag                               | Environment variable         | Default                  | Backend | Description                                                                  |
| ---------------------------------- | ---------------------------- | ------------------------ | ------- | ---------------------------------------------------------------------------- |
| `--backend <auto\|bridge\|docker>` | `POLARLN_BACKEND`            | `auto`                   | all     | The backend of the command. See [Backends](#backends).                       |
| `--url <url>`                      | `POLAR_MCP_PORT` (port only) | `http://localhost:37373` | bridge  | The bridge URL. Under auto, this flag selects the bridge.                    |
| `--data-dir <path>`                | `POLARLN_DATA_DIR`           | The Polar home           | docker  | The data folder of the Docker backend. Under auto, this flag selects Docker. |
| `--help`, `-h`                     | none                         | none                     | all     | Show the help. See [Help](#help).                                            |

The flag comes before the environment variable. An empty environment variable is the same as no variable.

The Polar home is the data folder of the Polar app: `~/.local/share/polar` if that folder exists, else `~/.polar`. A relative data folder path is relative to the current folder. For the container names of each data folder, see [Data folder](docker-backend.md#data-folder).

`polarln --version` and `polarln -v` show the version of polarln. They must be the first argument. They send no request to the bridge.

## Backends

The CLI runs each command with one backend:

- The bridge backend sends the command to the HTTP bridge of the Polar app. The Polar app runs the tool, so the app shows the change. One exception: after `add-node`, the chart shows no channel lines until the next chart sync.
- The Docker backend runs the tool on Docker, without the Polar app. It supports 31 of the 49 commands. The other commands give `501 PolarToolNotSupported`. See [Docker backend](docker-backend.md).

The backend is the `--backend` flag, then `POLARLN_BACKEND`, then `auto`. An empty `--backend` or `POLARLN_BACKEND` value is the same as no value.

### Auto

Auto selects the backend for each command, in this order:

1. `--url` selects the bridge. If the bridge does not answer, the command fails. There is no fallback to Docker.
2. `--data-dir` selects Docker. The CLI sends no request to the bridge.
3. `--url` together with `--data-dir` is the usage error `UnexpectedFlagForBackend`.
4. With neither flag, the CLI gets the tools of the bridge (`GET /api/mcp/tools`, with a timeout of 3 s). An answer with a list of Polar tools selects the bridge.
5. If the bridge refuses the connect, the CLI looks for a Polar process. If a Polar process runs, the command fails with `409 PolarAppRunsWithoutBridge`. Else, the command runs on Docker, also if the scan has no clear result.
6. Each other bridge failure ends the command with exit code 1. There is no fallback to Docker. Examples are a timeout, an error answer such as `504`, a different server, and a bad URL.

A failure in rule 6 does not prove that the app is off. Thus the CLI does not use Docker. An answer that is not a list of Polar tools gives `503 UnexpectedPolarBridgeResponse`.

The Docker backend checks for the Polar app before each change to the Polar home. This check also runs after rule 5. See [Polar app check](polar-app.md#polar-app-check).

Under auto, a `--url` or `--data-dir` flag with an empty value or with no value is the same as no flag. Thus `--data-dir "$DIR"` with an empty `$DIR` does not select Docker. A command with a flag that has no value is still the usage error `InvalidFlags`.

`POLARLN_DATA_DIR` sets the data folder of the Docker backend, but it does not select Docker.

### Bridge and docker

These rules apply if `--backend` or `POLARLN_BACKEND` selects `bridge` or `docker`:

- With `bridge`, the `--data-dir` flag is the usage error `UnexpectedFlagForBackend`. With `docker`, the `--url` flag is that usage error. An empty flag value also gives the error.
- With `bridge`, the CLI also gets the tools of the bridge, with the timeout of 3 s. A timeout gives `503 FailedToConnectToPolarBridge`. Each bridge failure ends the command with exit code 1.
- With `docker`, the CLI sends no tools request to the bridge.

If the Docker backend code cannot load, a command on Docker fails with `503 FailedToLoadDockerBackend`. This applies to each way that selects Docker.

### Docker in a shell or in CI

To run all commands of a shell on Docker, in a different data folder:

```sh
export POLARLN_BACKEND=docker
export POLARLN_DATA_DIR=/tmp/polarln-test
polarln create-network --name test
polarln start-network --network-id 1
polarln open-channel --network-id 1 --from-node alice --to-node bob --sats 250000
```

The Polar bridge does not work in CI without a desktop session. In CI, use these 2 settings. A data folder that is not the Polar home gets the `polarln` container names, and the Polar app check does not run.

In a PID namespace, for example in a Docker container or an LXD guest, the process scan cannot see the processes of the host. Then, if the bridge refuses the connect, each change to the Polar home gives `503 FailedToCheckPolarApp`. See [Polar app check](polar-app.md#polar-app-check).

## Help

These commands show the list of all commands:

```sh
polarln
polarln --help
polarln -h
polarln help
```

These commands show the flags of one command:

```sh
polarln open-channel --help
polarln open-channel -h
polarln help open-channel
polarln --help open-channel
```

The list shows the first sentence of each tool description. With Docker, the commands that the Docker backend does not support show in a separate list. These commands reject with `501`.

The help of a command shows the full tool description and the flags. The required flags come first, with the `(required)` mark. The help also shows the allowed values, the item keys of an array flag, and the `--no-` form of a boolean flag.

The help selects the backend in the same way as a command. Thus a bridge failure of rule 6 also ends the help with exit code 1. The docker help does not need Docker. To see it with no bridge request, run `polarln --help --backend docker`.

Line 3 of `polarln --help` shows the backend and the cause of the choice. Examples:

```text
Backend: bridge (auto: the Polar app answers at http://localhost:37373).
Backend: docker (auto: no Polar app at http://localhost:37373). Data folder: /home/u/.polar (the Polar home).
Backend: docker (auto: the Polar bridge does not answer at http://localhost:37373). Data folder: /home/u/.polar (the Polar home).
Backend: docker (--data-dir). Data folder: /tmp/x.
Backend: bridge (--backend). Bridge URL: http://localhost:37373.
Backend: docker (POLARLN_BACKEND). Data folder: /home/u/.polar (the Polar home).
```

The CLI shows the third example if the bridge refuses the connect and the scan for a Polar process has no clear result. Then a change to the Polar home gives `503 FailedToCheckPolarApp`.

The `(the Polar home)` mark shows if the data folder is `~/.local/share/polar` or `~/.polar`, also through a symlink.

## Output and exit codes

The result goes to stdout as JSON, with an indent of 2 spaces:

```sh
$ polarln list-networks --data-dir /tmp/polarln-empty
{
  "networks": []
}
```

An error goes to stderr as one JSON line: `[code, message, details]`. An `Error` object in `details` shows as `{cause, code, errors, message}`, with only the keys that have a value. For the codes, see [Errors](errors.md).

```sh
$ polarln open-channel --network-id 1
[400,"MissingRequiredFlags",{"flags":["--from-node","--to-node","--sats"]}]
```

| Exit code | Cause                                                                                |
| --------- | ------------------------------------------------------------------------------------ |
| 0         | The command succeeds. This includes the help and the version.                        |
| 1         | The command fails. This includes a bridge failure while the CLI selects the backend. |
| 2         | A usage error. The CLI does not run the tool.                                        |

## Usage errors

A usage error has the code `400` and the exit code 2.

| Message                       | Cause                                                                                                                                                                | `details`                |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `UnknownCommand`              | The backend does not have the command.                                                                                                                               | `{command}`              |
| `ExpectedCommandBeforeFlags`  | The first argument is a flag, and it is not `--help`, `-h`, `--version`, or `-v`.                                                                                    | `{command}`              |
| `InvalidFlags`                | An unknown flag, a value for a boolean flag, a flag with no value, or a positional argument.                                                                         | `{err}`                  |
| `InvalidFlags`                | A global flag (`--backend`, `--url`, or `--data-dir`) has no value, and the next argument is a flag.                                                                 | `{flag, value}`          |
| `MissingRequiredFlags`        | The command does not have all of its required flags. `flags` lists the flags that are not there.                                                                     | `{flags}`                |
| `ExpectedNumberForFlag`       | The value of a number or integer flag is not a number of that type.                                                                                                  | `{flag, type, value}`    |
| `ExpectedJsonForFlag`         | The value of an array or object flag is not a JSON array or a JSON object.                                                                                           | `{flag, type, value}`    |
| `ExpectedAllowedValueForFlag` | The value of a flag is not in its list of allowed values. This includes a `--backend` flag with no value, or with a value that is not `auto`, `bridge`, or `docker`. | `{allowed, flag, value}` |
| `ExpectedAllowedValueForEnv`  | `POLARLN_BACKEND` is not `auto`, `bridge`, or `docker`.                                                                                                              | `{allowed, env, value}`  |
| `UnexpectedFlagForBackend`    | The command has the flag of the other backend. See [Backends](#backends).                                                                                            | `{backend, flag, from}`  |

The CLI finds the command after it selects the backend. Thus, if the bridge fails, an unknown command gives the bridge error and the exit code 1.
