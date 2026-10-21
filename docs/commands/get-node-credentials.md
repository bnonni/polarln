<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln get-node-credentials

> Get the gRPC credentials (base64 TLS certificate, base64 macaroon, and socket) of a started LND, litd, or tapd node

## Usage

```sh
polarln get-node-credentials --network-id <number> --node-name <string>
```

## Flags

| Flag           | Type   | Required | Description        |
| -------------- | ------ | -------- | ------------------ |
| `--network-id` | number | yes      | ID of the network. |
| `--node-name`  | string | yes      | Name of the node.  |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: no. The command does not change files or containers.

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `getNodeCredentials`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await getNodeCredentials({polar, networkId: 1, nodeName: 'bob'});
```

## Example

```sh
polarln get-node-credentials --network-id 1 --node-name bob
```

<!-- END GENERATED -->

## Notes

`get-node-credentials` is a polarln command, not a Polar tool. The CLI adds it to the command list of each backend, after the Polar tools. In code, the method `getNodeCredentials` works with `polarBridge` and with `polarDocker`.

Use the result to connect the gRPC clients of other packages to a Polar node:

- `authenticatedLndGrpc` of [`lightning`](https://github.com/alexbosworth/lightning) takes the `lnd` value.
- `authenticatedTapdGrpc` of [`tapass`](https://github.com/bnonni/tapass) takes the `tapd` value.
- `authenticatedLitdGrpc` of [`litterm`](https://github.com/bnonni/litterm) takes the `litd` value.

For a code example, see [getNodeCredentials](../sdk.md#getnodecredentials).

### Result

The result has the `implementation` of the node, and one key for each daemon of the node:

| Node kind | Keys of the result                      |
| --------- | --------------------------------------- |
| LND       | `implementation`, `lnd`                 |
| tapd      | `implementation`, `tapd`                |
| litd      | `implementation`, `litd`, `lnd`, `tapd` |

Each daemon key has the value `{cert, macaroon, socket}`:

- `cert` is the TLS certificate file, as base64.
- `macaroon` is the macaroon file, as base64.
- `socket` is `localhost:<port>`, with the port of the daemon on the computer. polarln uses `localhost`, not `127.0.0.1`, because the Polar TLS certificates name `localhost`.

The files and the ports come from the node in the result of [`list-networks`](list-networks.md):

| Key    | Node kind | `cert`             | `macaroon`            | Port         |
| ------ | --------- | ------------------ | --------------------- | ------------ |
| `lnd`  | LND, litd | `paths.tlsCert`    | `paths.adminMacaroon` | `ports.grpc` |
| `tapd` | tapd      | `paths.tlsCert`    | `paths.adminMacaroon` | `ports.grpc` |
| `litd` | litd      | `paths.litTlsCert` | `paths.litMacaroon`   | `ports.web`  |
| `tapd` | litd      | `paths.litTlsCert` | `paths.tapMacaroon`   | `ports.web`  |

A litd node runs tapd in its own process (integrated mode). Thus the litd port also serves tapd. The `lnd` key has the admin macaroon.

### Steps

1. The command runs `list-networks` on the backend.
2. It finds the node by its name, in all node lists of the network.
3. It checks the node kind and the status of the node.
4. It reads the 2 files of each daemon.

polarln reads the files on the computer that runs polarln. Thus polarln and the Polar files must be on the same computer.

On Docker, `list-networks` reads only the networks file. Thus this command does not run the [Polar app check](../polar-app.md#polar-app-check), and it runs no Docker command. The status of the node comes from the networks file. See [Networks file](../docker-backend.md#networks-file).

### Errors

| Code | Message                                         | Cause                                                       | `details`          |
| ---- | ----------------------------------------------- | ----------------------------------------------------------- | ------------------ |
| 400  | `ExpectedNetworkIdToGetNodeCredentials`         | The network ID is not a safe integer.                       | None               |
| 400  | `ExpectedNodeNameToGetNodeCredentials`          | The node name is empty, or it is not a string.              | None               |
| 404  | `PolarNetworkNotFound`                          | No network has this ID.                                     | `{networkId}`      |
| 404  | `PolarNodeNotFound`                             | The network has no node with this name.                     | `{nodeName}`       |
| 400  | `UnsupportedImplementationToGetNodeCredentials` | The node is a bitcoind, btcd, c-lightning, or eclair node.  | `{implementation}` |
| 503  | `ExpectedStartedNodeToGetNodeCredentials`       | The status of the node in `list-networks` is not `Started`. | `{status}`         |
| 503  | `FailedToReadNodeCredentialFile`                | polarln cannot read a certificate or macaroon file.         | `{err, path}`      |

The errors of `list-networks` also come through, for example `503 FailedToConnectToPolarBridge`. See [getNodeCredentials errors](../errors.md#getnodecredentials-errors).
