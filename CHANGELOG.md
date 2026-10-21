# Changelog

## 0.2.1 (2026-10-21)

### Fixed

- An import of `polarln` does not load `@grpc/grpc-js` and `@grpc/proto-loader`. The first tool call of a `polarDocker` object loads them. With Node.js 24, the import takes about 13 ms. In 0.2.0, it took about 80 ms, also if you used only `polarBridge`.
- If the Docker tool code cannot load, for example because `@grpc/grpc-js` is not installed, each tool call of a `polarDocker` object rejects with `503 FailedToLoadDockerBackend`. In 0.2.0, the import of `polarln` failed.

## 0.2.0 (2026-10-21)

This minor release changes the CLI default, the `Status` type, and the type of the `polar` argument of 0.1.0. See "Changed".

### Changed

- The license is MIT, the same license as Polar and lnd. polarln uses code from these 2 projects. Before, the license was the Unlicense. Version 0.1.0 stays under the Unlicense.
- The usage docs moved from the README to `docs/`. The README uses the Standard Readme layout. Each CLI command has a reference page in `docs/commands/`, and `pnpm write-docs` writes the generated part of each page. See [Documentation](docs/README.md).
- The CLI default backend is `auto`. If the Polar app runs, the CLI uses the bridge, as in 0.1.0. Else, the CLI runs the command on Docker, with the networks of the Polar app. See [Backends](docs/cli.md#backends).
- The `Status` type has no `Locked` label, because Polar v4.0.0 has no such status. If the LND wallet stays locked, the node gets `Error` with the `errorMsg` "The LND wallet is locked".
- The type of the `polar` argument in `PolarArgs` and `GetNodeCredentialsArgs` is `PolarBackend` (`Polar | PolarDocker`). Before, the type was `Polar`. If your code reads `polar.url` or `polar.fetch` from these types, first make sure that the object is a `Polar` object.
- polarln has 2 runtime dependencies: `@grpc/grpc-js` and `@grpc/proto-loader`. The Lightning tools of `polarDocker` use them. The package also has the lnd protos in `protos/`. Version 0.1.0 had no runtime dependencies. An import of `polarln` loads `@grpc/grpc-js`, also if you use only `polarBridge`.
- The CLI request for the bridge tools has a timeout of 3 s. Before, the CLI could wait up to 300 s under Node.js for a port that did not answer.

### Added

- `polarDocker` (preview): the Polar tools on Docker, without the Polar app. It has 30 of the 48 Polar tools: the bitcoin tools, the Lightning tools without Taproot Assets, and the network and node tools except `import_network_from_zip`, `export_network_to_zip`, and `set_tap_backend`. The data folder is the `dataDir` argument, then `POLARLN_DATA_DIR`, then the Polar home (`~/.local/share/polar` if it exists, else `~/.polar`).
- In the Polar home, `polarDocker` uses the Polar networks file, the Polar charts, and the Polar container names. It does not change the Polar files while the Polar app runs.
- A start and a stop with `polarDocker` use the compose file of the network. Thus networks with litd and tapd nodes start and stop. The Lightning tools also work on litd nodes. As in Polar, `docker compose` runs in the network folder, so it also reads an override file.
- The CLI flags `--backend <auto|bridge|docker>` and `--data-dir <path>`, and the environment variables `POLARLN_BACKEND` and `POLARLN_DATA_DIR`. Line 3 of `polarln --help` shows the backend and the cause of the choice. New usage errors: `ExpectedAllowedValueForEnv` and `UnexpectedFlagForBackend`.
- `getNodeCredentials` also works with `polarDocker`.
- `listTools` takes an optional `timeout` in milliseconds.
- The types `PolarBackend`, `PolarDocker`, and `PolarDockerArgs`.
- `SetAutoMineModeResult` has the `modeName` field, for example `"Every 30 seconds"`. The Polar v4.0.0 bridge also sends this field.
- New errors: `409 ComposeFileHasOtherServices`, `409 ContainerNameInUse`, `409 NetworkPathOutsideDataFolder`, `409 NetworksFileBusy`, `409 PolarAppIsRunning`, `409 PolarAppRunsWithoutBridge`, `409 PolarPortInUse`, `503 DockerNotAvailable`, `503 FailedToCheckPolarApp`, `503 FailedToLoadDockerBackend`, and `503 FailedToReadNetworksFile`. See [Docker backend and CLI errors](docs/errors.md#docker-backend-and-cli-errors).

### Fixed

- A global flag (`--url`, `--backend`, or `--data-dir`) with no value, before a different flag, gives `400 InvalidFlags` with `{flag, value}` and the exit code 2. In 0.1.0, `--url` took the next flag as the URL, and the command failed with `503 FailedToConnectToPolarBridge` and the exit code 1.

## 0.1.0 (2026-10-17)

- The first release: 48 methods for the Polar v4 bridge tools, `getNodeCredentials`, and the `polarln` CLI.
