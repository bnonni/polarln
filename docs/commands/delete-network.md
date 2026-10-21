<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln delete-network

> Permanently deletes a Lightning Network in Polar. This will remove all nodes, channels, and data associated with the network. This action cannot be undone.

## Usage

```sh
polarln delete-network --network-id <number>
```

## Flags

| Flag           | Type   | Required | Description                  |
| -------------- | ------ | -------- | ---------------------------- |
| `--network-id` | number | yes      | ID of the network to delete. |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: yes. In the Polar home, the command first checks that the Polar app does not run. See [Polar app check](../polar-app.md#polar-app-check).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `deleteNetwork`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await deleteNetwork({polar, networkId: 1});
```

## Example

```sh
polarln delete-network --network-id 1
```

<!-- END GENERATED -->

## Notes

### Docker backend

- The command first stops the network if a status is not `Stopped`, also a tapd status, or if a container of the network runs. Polar does not look at the tapd statuses or at the containers.
- Then the command deletes the network folder with all node data. It also removes the network and its chart from the networks file.
- The folder delete runs with the write of the networks file. If a check refuses the write, the folder stays.
- The command looks for the containers of the network (`docker ps`), also for a stopped network. Thus it needs Docker. Without Docker, it gives `503 DockerNotAvailable`.
- The command works with all node kinds.
- The result shows the network as it was before the delete.
- If the network folder in the networks file is not `<dataDir>/networks/<id>`, the command gives `409 NetworkPathOutsideDataFolder` and makes no change. For example, a copy of a data folder has the paths of the original.

### Polar app check

- In the Polar home, the check runs before the command, and again before each write of the networks file.
- The check also runs before the folder delete (`stage: 'before-delete'`). At this refusal, the stop of the network can be in effect.

### See also

- [`stop-network`](stop-network.md)
- [`list-networks`](list-networks.md)
- [Polar app check](../polar-app.md#polar-app-check)
