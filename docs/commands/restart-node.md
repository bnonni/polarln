<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln restart-node

> Restarts a specific node in a Polar network. The node must be in Started or Error state. This operation stops the node first, then starts it again. Supports Bitcoin Core, Lightning Network, and Taproot Assets daemon nodes.

## Usage

```sh
polarln restart-node --network-id <number> --node-name <string>
```

## Flags

| Flag           | Type   | Required | Description                            |
| -------------- | ------ | -------- | -------------------------------------- |
| `--network-id` | number | yes      | ID of the network containing the node. |
| `--node-name`  | string | yes      | Name of the node to restart.           |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: yes. In the Polar home, the command first checks that the Polar app does not run. See [Polar app check](../polar-app.md#polar-app-check).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `restartNode`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await restartNode({polar, networkId: 1, nodeName: 'alice'});
```

## Example

```sh
polarln restart-node --network-id 1 --node-name alice
```

<!-- END GENERATED -->

## Notes

### Docker backend

- The node must have the `Started` or `Error` status. Else the command gives `400 PolarRejectedArguments`.
- As in Polar, a node with the `Error` status only starts.
- The command checks the start before the stop. Thus a start that the checks refuse does not stop the node.
- The command stops the node, waits 100 ms as Polar does, and starts the node. It returns after the node is online. Polar returns before the node is online.
- The start has the same port check, the same wait of 2 minutes, and the same `nodeStatus` result as [`start-node`](start-node.md).
- The start uses the compose file of the network. Thus a restart applies a new command from [`update-node-command`](update-node-command.md).

### Polar app check

- In the Polar home, the check runs before the command, and again before each write of the networks file.
- At a `before-save` refusal, the stop of the node and the steps of `start-node` can be in effect.

### See also

- [`start-node`](start-node.md)
- [`stop-node`](stop-node.md)
- [`update-node-command`](update-node-command.md)
