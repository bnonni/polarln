<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln add-node

> Adds a Bitcoin Core or Lightning Network node to an existing Polar network. Supports Bitcoin Core (bitcoind), LND, c-lightning, eclair, and litd (Lightning Terminal) implementations. If the network is started, the node will be automatically started as well.

## Usage

```sh
polarln add-node --network-id <number> --implementation <string> \
  [--version <string>]
```

## Flags

| Flag               | Type   | Required | Description                                                                                                                        |
| ------------------ | ------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `--network-id`     | number | yes      | ID of the network to add the node to.                                                                                              |
| `--implementation` | string | yes      | Node implementation to use. Values: `LND`, `c-lightning`, `eclair`, `bitcoind`, `btcd`, `tapd`, `litd`.                            |
| `--version`        | string | no       | Version of the implementation (optional, uses latest if not specified). Use the list_node_versions tool to see supported versions. |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: yes. In the Polar home, the command first checks that the Polar app does not run. See [Polar app check](../polar-app.md#polar-app-check).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `addNode`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await addNode({polar, networkId: 1, implementation: 'LND'});
```

## Example

```sh
polarln add-node --network-id 1 --implementation LND
```

<!-- END GENERATED -->

## Notes

### Docker backend

- The Docker backend adds only `bitcoind` and `LND` nodes. A different implementation gives `501 PolarToolNotSupported` before any change.
- The network must have only bitcoind and LND nodes, and no other compose services. Else the command gives `501 PolarToolNotSupported` or `409 ComposeFileHasOtherServices` before any change.
- `--version` must be a version from [`list-node-versions`](list-node-versions.md). With no `--version`, the node gets the latest version of Polar v4.0.0.
- A new LND node gets the next Polar name, for example `carol`. Its backend is a compatible bitcoind node. The LND nodes use the compatible bitcoind nodes in turn. If no bitcoind node is compatible, the command gives an error.
- A new bitcoind node gets the next name, for example `backend2`. It becomes a peer of the last bitcoind node.
- The command writes the networks file and a new compose file. If the network is started, the command starts the node and returns after the node is online. Polar returns before the node is online.
- The node gets the Polar v4.0.0 base ports plus the node index, and the default command. polarDocker does not read the Polar settings (`settings.json` and `nodes.json`).
- On a stopped network, the command needs Docker only for a compose file that polarDocker did not write. For such a file, the compose check runs `docker compose config`.

### Bridge

- With the bridge, the Polar app shows the new node. But the chart shows no channel lines until the next chart sync.

### Polar app check

- In the Polar home, the check runs before the command, and again before each write of the networks file.
- At a refusal of the first write, the command made no change. On a started network, the start of the node writes again. At a refusal of that write, the new compose file and the container of the new node can be in effect.

### See also

- [`list-node-versions`](list-node-versions.md)
- [`remove-node`](remove-node.md)
- [`start-node`](start-node.md)
- [Node kinds](../docker-backend.md#node-kinds)
