<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln remove-node

> Removes a node from an existing Polar network. This will permanently delete the node and all its data. Supports removing Lightning nodes (LND, c-lightning, eclair, litd), Bitcoin nodes (bitcoind), and Taproot Asset nodes (tapd). If the network is running, the node will be stopped before removal.

## Usage

```sh
polarln remove-node --network-id <number> --node-name <string>
```

## Flags

| Flag           | Type   | Required | Description                                      |
| -------------- | ------ | -------- | ------------------------------------------------ |
| `--network-id` | number | yes      | ID of the network containing the node to remove. |
| `--node-name`  | string | yes      | Name of the node to remove from the network.     |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: yes. In the Polar home, the command first checks that the Polar app does not run. See [Polar app check](../polar-app.md#polar-app-check).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `removeNode`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await removeNode({polar, networkId: 1, nodeName: 'carol'});
```

## Example

```sh
polarln remove-node --network-id 1 --node-name carol
```

<!-- END GENERATED -->

## Notes

### Docker backend

- On Docker, the network must have only bitcoind and LND nodes, and no other compose services. Else the command gives `501 PolarToolNotSupported` or `409 ComposeFileHasOtherServices` before any change.
- The command writes the networks file and a new compose file. Then it deletes the node folder, for example `volumes/lnd/<name>` in the network folder.
- On a stopped network, the command needs Docker only if the node is not stopped, or for a compose file that polarDocker did not write.

An LND node:

- If the network is started, or if the node is not stopped, the command first stops and removes the container of the node. Polar removes the container only if the network is started.

A bitcoind node:

- The command does not remove the only bitcoind node of a network. This gives `400 PolarRejectedArguments`.
- Each LND node of the removed node moves to the first compatible bitcoind node. If there is no compatible node, the command gives an error. Then remove that LND node first.
- If the node is between 2 bitcoind nodes, these 2 nodes become peers. Thus the network keeps one chain.
- On a started network, the command stops the network, writes a new compose file, and starts the network again. It returns after the nodes are online.

### Polar app check

- In the Polar home, the check runs before the command, and again before each write of the networks file.
- At a `before-save` refusal, the removed container can be in effect. The new compose file comes after the check, with the write.
- For a bitcoind node of a started network, the stop of the network can be in effect. Then the new compose file and the start of the network can also be in effect.

### See also

- [`add-node`](add-node.md)
- [`rename-node`](rename-node.md)
- [Node kinds](../docker-backend.md#node-kinds)
