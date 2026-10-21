<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln rename-node

> Renames a node in an existing Polar network. This will update the node name throughout the system, including Docker containers, configuration files, and UI references. Supports renaming Lightning nodes (LND, c-lightning, eclair, litd), Bitcoin nodes (bitcoind), and Taproot Asset nodes (tapd). If the network is running, it will be temporarily stopped during the rename operation.

## Usage

```sh
polarln rename-node --network-id <number> --old-name <string> \
  --new-name <string>
```

## Flags

| Flag           | Type   | Required | Description                                      |
| -------------- | ------ | -------- | ------------------------------------------------ |
| `--network-id` | number | yes      | ID of the network containing the node to rename. |
| `--old-name`   | string | yes      | Current name of the node to rename.              |
| `--new-name`   | string | yes      | New name for the node.                           |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: yes. In the Polar home, the command first checks that the Polar app does not run. See [Polar app check](../polar-app.md#polar-app-check).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `renameNode`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await renameNode({polar, networkId: 1, oldName: 'carol', newName: 'charlie'});
```

## Example

```sh
polarln rename-node --network-id 1 --old-name carol --new-name charlie
```

<!-- END GENERATED -->

## Notes

### Docker backend

- On Docker, the network must have only bitcoind and LND nodes, and no other compose services. Else the command gives `501 PolarToolNotSupported` or `409 ComposeFileHasOtherServices` before any change.
- The new name must have only letters, numbers, hyphens, and underscores. Else the command gives `400 PolarRejectedArguments`. The name of a different node of the network gives an error.
- If a container of the network runs, or if the node or the network was started, the command first stops the network. Thus no container with the old name stays.
- If the node or the network was started, the command starts the network again after the rename. It returns after the nodes are online.
- The command moves the node folder to the new name. For a bitcoind node, it also changes the backend name of its LND nodes and the peers of the other bitcoind nodes. The chart node keeps its position.
- For an LND node, the command deletes the TLS certificate and key. lnd makes a new certificate for the new host name at the next start. Then get the credentials again with [`get-node-credentials`](get-node-credentials.md).
- The command looks for the containers of the network (`docker ps`), also for a stopped network. Thus it needs Docker. Without Docker, it gives `503 DockerNotAvailable`.

### Polar app check

- In the Polar home, the check runs before the command, and again before each write of the networks file.
- The check also runs before the folder move (`stage: 'before-delete'`). At this refusal, the stop of the network can be in effect.
- The folder move, the TLS file delete, and the new compose file come after the `before-save` check, with the write. At a refusal of the start after the rename, the rename and the steps of `start-network` can be in effect.

### Differences from the Polar app

- Polar stops and starts the network only if the node was started. Polar also does not wait for the start.

### See also

- [`remove-node`](remove-node.md)
- [`get-node-credentials`](get-node-credentials.md)
- [`start-network`](start-network.md)
