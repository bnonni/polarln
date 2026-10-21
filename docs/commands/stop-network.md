<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln stop-network

> Stops a Lightning Network in Polar. This will gracefully shut down all Bitcoin and Lightning nodes in the specified network.

## Usage

```sh
polarln stop-network --network-id <number>
```

## Flags

| Flag           | Type   | Required | Description                |
| -------------- | ------ | -------- | -------------------------- |
| `--network-id` | number | yes      | ID of the network to stop. |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: yes. In the Polar home, the command first checks that the Polar app does not run. See [Polar app check](../polar-app.md#polar-app-check).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `stopNetwork`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await stopNetwork({polar, networkId: 1});
```

## Example

```sh
polarln stop-network --network-id 1
```

<!-- END GENERATED -->

## Notes

### Docker backend

- As in Polar, the command runs `docker compose down` in the network folder. This stops and removes the containers of the compose file. The node data stays in the network folder.
- The command stops each service of the compose file: all node kinds, and also a service that a user added. A container that the compose file does not have stays.
- After the stop, the file gets the `Stopped` status and the auto mine mode `0` (off). A failure after the checks saves the `Error` status.
- The command accepts each network status. Thus it repairs a `Starting` or `Stopping` status that the Polar app left. It also repairs a `Started` status after a crash of the Polar app.
- Before Docker runs, the command checks that it can write the networks file. If this check refuses, the command saves no status and runs no Docker command.
- Without a compose file, `docker compose` uses a file of a parent folder. Thus the command gives an error if the network folder has no compose file.

### Polar app check

- In the Polar home, the check runs before the command, and again before the write of the networks file.
- At a `before-save` refusal, the command already stopped and removed the containers of the network. But the file keeps the old statuses.

### See also

- [`start-network`](start-network.md)
- [`delete-network`](delete-network.md)
- [`stop-node`](stop-node.md)
