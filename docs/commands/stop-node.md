<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln stop-node

> Stops a specific node in a Polar network. The node must be in Started state. Supports Bitcoin Core, Lightning Network, and Taproot Assets daemon nodes.

## Usage

```sh
polarln stop-node --network-id <number> --node-name <string>
```

## Flags

| Flag           | Type   | Required | Description                            |
| -------------- | ------ | -------- | -------------------------------------- |
| `--network-id` | number | yes      | ID of the network containing the node. |
| `--node-name`  | string | yes      | Name of the node to stop.              |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: yes. In the Polar home, the command first checks that the Polar app does not run. See [Polar app check](../polar-app.md#polar-app-check).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `stopNode`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await stopNode({polar, networkId: 1, nodeName: 'alice'});
```

## Example

```sh
polarln stop-node --network-id 1 --node-name alice
```

<!-- END GENERATED -->

## Notes

### Docker backend

- The command runs `docker compose stop <node>`. The container and the node data stay. The network status does not change.
- The command works with all node kinds.
- The command also stops a node with the `Error` status, for example an LND node with a locked wallet. The container of such a node can run. Polar stops only a `Started` node.
- For a different status, the command gives `400 PolarRejectedArguments`. As in Polar, the error message ends with `Only Started nodes can be stopped.`
- Before Docker runs, the command checks that it can write the networks file. After the stop, the file gets the `Stopped` status. A failure after the checks saves the `Error` status.

### Polar app check

- In the Polar home, the check runs before the command, and again before the write of the networks file.
- At a `before-save` refusal, the command already stopped the container of the node. But the file keeps the old status.

### See also

- [`start-node`](start-node.md)
- [`restart-node`](restart-node.md)
- [`stop-network`](stop-network.md)
