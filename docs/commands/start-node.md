<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln start-node

> Starts a specific node in a Polar network. The node must be in Stopped or Error state. Supports Bitcoin Core, Lightning Network, and Taproot Assets daemon nodes.

## Usage

```sh
polarln start-node --network-id <number> --node-name <string>
```

## Flags

| Flag           | Type   | Required | Description                            |
| -------------- | ------ | -------- | -------------------------------------- |
| `--network-id` | number | yes      | ID of the network containing the node. |
| `--node-name`  | string | yes      | Name of the node to start.             |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: yes. In the Polar home, the command first checks that the Polar app does not run. See [Polar app check](../polar-app.md#polar-app-check).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `startNode`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await startNode({polar, networkId: 1, nodeName: 'alice'});
```

## Example

```sh
polarln start-node --network-id 1 --node-name alice
```

<!-- END GENERATED -->

## Notes

### Docker backend

- The command works with all node kinds. It uses the compose file of the network: `docker compose stop <node>`, then `docker compose up -d <node>`. The stop is necessary, because a container in an error state does not start again without a stop.
- The node must have the `Stopped` or `Error` status. Else the command gives `400 PolarRejectedArguments`. To repair a `Starting` or `Stopping` status in the file, run [`start-network`](start-network.md) or [`stop-network`](stop-network.md).
- The command returns after the node is online. Polar returns before the node is online, with the `Starting` status.
- After a bitcoind node is online, the command mines 1 block. After an LND or litd node is online, the command connects all LND and litd nodes of the network to each other.
- The wait for a bitcoind, LND, or litd node stops after 2 minutes. A node that is not online then gets the `Error` status. The command still succeeds, so check `nodeStatus` in the result.
- The network status does not change.
- If the network has only bitcoind and LND nodes and no other services, a busy port of each stopped node can move, as in Polar.
- On a different network, the command checks only the ports of its node. A busy port then gives `409 PolarPortInUse` or `409 ComposeFileHasOtherServices`. Polar moves the busy ports of all stopped nodes.
- Before Docker runs, the command checks that it can write the networks file. A failure after the checks saves the `Error` status of the node.

### Polar app check

- In the Polar home, the check runs before the command, and again before each write of the networks file.
- At a `before-save` refusal, a new compose file, the volume folders, and the container of the node can be in effect. The startup steps can also be in effect. The file keeps the old status.

### See also

- [`stop-node`](stop-node.md)
- [`restart-node`](restart-node.md)
- [`start-network`](start-network.md)
- [Startup checks](../docker-backend.md#startup-checks)
