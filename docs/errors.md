# Errors

This page shows the errors of the polarln methods and of the `polarln` command.

## Error format

Each method rejects with an array: `[code, message, details]`. The type is `PolarError`.

- `code` is a number, as an HTTP status code: 400, 404, 409, 501, 503, or 504.
- `message` is a fixed name, for example `PolarNodeNotFound`. Use this name in your code.
- `details` is an object with more data. Two errors of `getNodeCredentials` have no `details`.

```ts
import {mineBlocks, polarBridge} from 'polarln';
import type {PolarError} from 'polarln';

const {polar} = polarBridge();

try {
  await mineBlocks({polar, networkId: 1, blocks: 6});
} catch (err) {
  const [code, message, details] = err as PolarError;

  console.error(code, message, details);
}
```

Polar sends each tool error as an HTTP 500 with only a message. polarln maps the message to a code and a name (see [Bridge and tool errors](#bridge-and-tool-errors)). The Docker backend uses the same map for each error that is not in the [Docker table](#docker-backend-and-cli-errors). Then `details` is `{err, tool}`:

- `err` is the message of Polar or of the Docker backend.
- `tool` is the name of the Polar tool, for example `open_channel`. For `listTools`, it is an empty string.

The CLI writes an error to stderr as one JSON line. An `Error` object in `details` shows as `{cause, code, errors, message}`, with only the keys that have a value. For the exit codes, see [Output and exit codes](cli.md#output-and-exit-codes).

## Bridge and tool errors

These errors come from the bridge backend, and from the map of the tool messages:

| Code | Message                         | Cause                                                                                                                                         | `details`             |
| ---- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 400  | `ExpectedPolarBridge`           | The `polar` argument is not there, or it is not a backend object. `listTools` also gives this error for a `polarDocker` object.               | `{tool}`              |
| 400  | `PolarRejectedArguments`        | Polar rejected an argument.                                                                                                                   | `{err, tool}`         |
| 404  | `PolarNetworkNotFound`          | The network does not exist.                                                                                                                   | `{err, tool}`         |
| 404  | `PolarNodeNotFound`             | The node does not exist, or the network has no node of the necessary kind.                                                                    | `{err, tool}`         |
| 404  | `PolarObjectNotFound`           | Another object does not exist, for example a file or a network folder.                                                                        | `{err, tool}`         |
| 501  | `PolarToolNotSupported`         | Polar or `polarDocker` does not have the tool. Or `polarDocker` does not support the node kind, the networks file version, or a status value. | `{err, tool}`         |
| 503  | `DockerNotAvailable`            | `polarDocker` cannot use Docker: Docker is not installed or does not run, or you cannot use the Docker socket.                                | `{err, tool}`         |
| 503  | `FailedToConnectToPolarBridge`  | The Polar app does not run, the port or the URL is wrong, or the full answer did not come before the timeout.                                 | `{err, tool}`         |
| 503  | `PolarToolFailed`               | Polar or a node returned another error.                                                                                                       | `{err, tool}`         |
| 503  | `UnexpectedPolarBridgeResponse` | The answer is not an answer of the Polar bridge.                                                                                              | `{err, status, tool}` |
| 504  | `PolarToolTimedOut`             | The Polar bridge stopped the wait for the tool after 30 s. Or a different message tells about a timeout.                                      | `{err, tool}`         |

For `listTools`, `details` has no `tool` key, except in the errors of the map.

The map checks the message in this order. The first rule that matches gives the code and the name.

1. The message starts with `Docker is not available`: `503 DockerNotAvailable`.
2. The message is `Network directory <path> does not exist`: `404 PolarObjectNotFound`.
3. The message starts with `Unknown tool` or `polarDocker does not support`: `501 PolarToolNotSupported`.
4. The message has `timed out` or `timeout`: `504 PolarToolTimedOut`.
5. The message starts with `Network` and has `not found`: `404 PolarNetworkNotFound`.
6. The message has `node` and then `not found`, or `has no` and then `nodes`: `404 PolarNodeNotFound`.
7. The message has `not found` or `does not exist`: `404 PolarObjectNotFound`.
8. The message has `is required`, `must`, `cannot`, or `invalid`: `400 PolarRejectedArguments`.
9. Each other message gives `503 PolarToolFailed`.

Rules 4 to 8 and the `Unknown tool` text of rule 3 ignore the letter case. The rules match whole words.

More about some of these errors:

- `FailedToConnectToPolarBridge`: `err` is the fetch error. A refused connect has the code `ECONNREFUSED` in the `cause` (Node.js), or the code `ConnectionRefused` (bun). The tool methods have no timeout. `listTools` has the `timeout` argument, and the CLI uses 3 s.
- `UnexpectedPolarBridgeResponse`: `status` is the HTTP status, and `err` is the `error` value of the body, if the body has one. Examples are a different server on the bridge port, and an answer that is not JSON.
- `PolarToolTimedOut`: the Polar bridge waits 30 s for a tool and 5 s for the tool list. The bridge stops the wait, not the tool. Thus the tool can finish in the Polar app after the error. Before you try again, look at the state, for example with `listNetworks`.
- `PolarToolTimedOut` also comes from the Docker backend. For example, `closeChannel` gives `Channel close timed out after 60 s`.
- `PolarObjectNotFound`: the Docker backend gives this error if the network folder does not exist.

## Docker backend and CLI errors

The Docker backend and the CLI also give these errors. They have their own `details`, with no `tool` key.

| Code | Message                        | Cause                                                                                                                                                                                                                   | `details`                                 |
| ---- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 409  | `ComposeFileHasOtherServices`  | A tool must write a new compose file, but the compose files have a service that is not a node, for example `electrs`. A node with no service is not an error.                                                           | `{networkId, path, services}`             |
| 409  | `ContainerNameInUse`           | A container with the compose project of the network, or with the name of a node, is not a container of the network folder. Examples are a container of a different data folder, and a container with no compose labels. | `{container, project, workingDir}`        |
| 409  | `NetworkPathOutsideDataFolder` | The networks file has a network folder that is not `<dataDir>/networks/<id>`, or a node file that is not in the network folder. A copy of a data folder has the paths of the original.                                  | `{expected, networkId, path}`             |
| 409  | `NetworksFileBusy`             | A different change holds the lock of the networks file for more than 3 s.                                                                                                                                               | `{dataDir}`                               |
| 409  | `PolarAppIsRunning`            | The Polar app runs, and the tool can change the Polar home.                                                                                                                                                             | `{dataDir, found, hint, pid\|url, stage}` |
| 409  | `PolarAppRunsWithoutBridge`    | CLI auto: the bridge refuses the connect, but a Polar process runs.                                                                                                                                                     | `{hint, pid, url}`                        |
| 409  | `PolarPortInUse`               | A port of a node that starts is in use. The network has a node kind that `polarDocker` cannot write to a compose file (tapd, litd, c-lightning, eclair, or btcd), so the port cannot move.                              | `{node, port}`                            |
| 503  | `FailedToCheckPolarApp`        | The Polar app check has no clear result.                                                                                                                                                                                | `{dataDir, err}`                          |
| 503  | `FailedToLoadDockerBackend`    | The CLI or a `polarDocker` tool call cannot load the Docker backend code.                                                                                                                                               | `{err}`                                   |
| 503  | `FailedToReadNetworksFile`     | `polarDocker` cannot read the networks file. It does not write the file.                                                                                                                                                | `{err, path}`                             |

## Notes

- `ComposeFileHasOtherServices`: `path` is the compose file of the network. `services` lists only the services that are not nodes. The services of an override file also count, for example of `docker-compose.override.yml`.
- On a network with only bitcoind and LND nodes, a compose file with other services stops a port move. Then a busy port of a node that starts gives `ComposeFileHasOtherServices`, not `PolarPortInUse`.
- `ContainerNameInUse`: `container` is the name of the other container. `project` and `workingDir` are its compose labels. They are empty if the container has no compose labels.
- `NetworkPathOutsideDataFolder` has 2 shapes. For a network folder, `expected` is `<dataDir>/networks/<id>`, and `path` is the network folder. For a node file, `expected` is the network folder, and `path` is the node file.
- `NetworksFileBusy`: the lock is the folder `networks/networks.json.lock` in the data folder. A lock folder that is older than 30 s is from a process that stopped. The next change removes it.
- `PolarAppIsRunning` has `found: 'bridge'` and the bridge `url`, or `found: 'process'` and the process `pid`. `hint` tells you what to do. For `stage`, see [Polar app check](polar-app.md#polar-app-check).
- `PolarAppRunsWithoutBridge`: `url` is the bridge URL that the CLI tried, and `pid` is the Polar process. `hint` tells you what to do. See [Backends](cli.md#backends).
- `FailedToCheckPolarApp`: `err` is an `Error`, with the cause in `err.cause`. Its message is `The Polar bridge check at <url> gave no clear result` or `The Polar process check gave no clear result`.
- `FailedToReadNetworksFile` has one of these `err` values: the JSON parse message, `The file has no networks array`, `A network has no node arrays, or a node is not an object`, `The charts key is not an object`, or `The networks file is not there, but the network folders are`. The last value occurs only in the Polar home.
- The CLI also gives `503 UnexpectedPolarBridgeResponse` if the tools answer of the bridge is not a list of Polar tools. Then `details` is `{err: 'ExpectedArrayOfPolarTools', url}`.

## getNodeCredentials errors

[`getNodeCredentials`](sdk.md#getnodecredentials) gives these errors. It also gives the errors of `listNetworks`.

| Code | Message                                         | Cause                                                  | `details`          |
| ---- | ----------------------------------------------- | ------------------------------------------------------ | ------------------ |
| 400  | `ExpectedNetworkIdToGetNodeCredentials`         | `networkId` is not an integer.                         | None               |
| 400  | `ExpectedNodeNameToGetNodeCredentials`          | `nodeName` is not a string, or it is empty.            | None               |
| 400  | `UnsupportedImplementationToGetNodeCredentials` | The node is not an LND, litd, or tapd node.            | `{implementation}` |
| 404  | `PolarNetworkNotFound`                          | No network has the `networkId`.                        | `{networkId}`      |
| 404  | `PolarNodeNotFound`                             | The network has no node with the `nodeName`.           | `{nodeName}`       |
| 503  | `ExpectedStartedNodeToGetNodeCredentials`       | The status of the node is not `Started`.               | `{status}`         |
| 503  | `FailedToReadNodeCredentialFile`                | The method cannot read a cert file or a macaroon file. | `{err, path}`      |

## CLI usage errors

A usage error is a `400` error of the CLI. The CLI does not run the tool, and the exit code is 2. The usage errors are `UnknownCommand`, `ExpectedCommandBeforeFlags`, `InvalidFlags`, `MissingRequiredFlags`, `ExpectedNumberForFlag`, `ExpectedJsonForFlag`, `ExpectedAllowedValueForFlag`, `ExpectedAllowedValueForEnv`, and `UnexpectedFlagForBackend`.

For the cause of each usage error, see [Usage errors](cli.md#usage-errors).
