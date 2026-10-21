# Changelog

## Unreleased

The next release must be a minor release (0.2.0). It changes the CLI default and the `Status` type of 0.1.0.

### Changed

- The usage docs moved from the README to `docs/`. The README uses the Standard Readme layout. Each CLI command has a reference page in `docs/commands/`, and `pnpm write-docs` writes the generated part of each page. See [Documentation](docs/README.md).
- The CLI default backend is `auto`. If the Polar app runs, the CLI uses the bridge, as in 0.1.0. Else, the CLI runs the command on Docker, with the networks of the Polar app. See [Backends](docs/cli.md#backends).
- The `Status` type has no `Locked` label, because Polar v4.0.0 has no such status. If the LND wallet stays locked, the node gets `Error` with the `errorMsg` "The LND wallet is locked".
- The CLI request for the bridge tools has a timeout of 3 s. Before, the CLI could wait up to 300 s under Node.js for a port that did not answer.

### Added

- `polarDocker` (preview): the Polar tools on Docker, without the Polar app. It has 30 tools: the network, node, bitcoin, and Lightning tools. The data folder is the `dataDir` argument, then `POLARLN_DATA_DIR`, then the Polar home (`~/.local/share/polar` if it exists, else `~/.polar`).
- In the Polar home, `polarDocker` uses the Polar networks file, the Polar charts, and the Polar container names. It does not change the Polar files while the Polar app runs.
- A start and a stop with `polarDocker` use the compose file of the network. Thus networks with litd and tapd nodes start and stop. The Lightning tools also work on litd nodes. As in Polar, `docker compose` runs in the network folder, so it also reads an override file.
- The CLI flags `--backend <auto|bridge|docker>` and `--data-dir <path>`, and the environment variables `POLARLN_BACKEND` and `POLARLN_DATA_DIR`. Line 3 of `polarln --help` shows the backend and the cause of the choice. New usage errors: `ExpectedAllowedValueForEnv` and `UnexpectedFlagForBackend`.
- `getNodeCredentials` also works with `polarDocker`.
- `listTools` takes an optional `timeout` in milliseconds.
- New errors: `409 ComposeFileHasOtherServices`, `409 ContainerNameInUse`, `409 NetworkPathOutsideDataFolder`, `409 NetworksFileBusy`, `409 PolarAppIsRunning`, `409 PolarAppRunsWithoutBridge`, `409 PolarPortInUse`, `503 DockerNotAvailable`, `503 FailedToCheckPolarApp`, `503 FailedToLoadDockerBackend`, and `503 FailedToReadNetworksFile`. See [Docker backend and CLI errors](docs/errors.md#docker-backend-and-cli-errors).

## 0.1.0 (2026-10-17)

- The first release: 48 methods for the Polar v4 bridge tools, `getNodeCredentials`, and the `polarln` CLI.
