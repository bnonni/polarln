<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln set-lightning-backend

> Changes the Bitcoin backend node for a Lightning Network node. This reassigns which Bitcoin node the Lightning node will connect to as its backend. If the network is running, the Lightning node will be restarted to apply the change.

## Usage

```sh
polarln set-lightning-backend --network-id <number> \
  --lightning-node-name <string> --bitcoin-node-name <string>
```

## Flags

| Flag                    | Type   | Required | Description                                                 |
| ----------------------- | ------ | -------- | ----------------------------------------------------------- |
| `--network-id`          | number | yes      | ID of the network containing the nodes.                     |
| `--lightning-node-name` | string | yes      | Name of the Lightning node whose backend should be changed. |
| `--bitcoin-node-name`   | string | yes      | Name of the Bitcoin node to set as the backend.             |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: yes. In the Polar home, the command first checks that the Polar app does not run. See [Polar app check](../polar-app.md#polar-app-check).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `setLightningBackend`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await setLightningBackend({
  polar,
  networkId: 1,
  lightningNodeName: 'alice',
  bitcoinNodeName: 'backend2',
});
```

## Example

```sh
polarln set-lightning-backend --network-id 1 --lightning-node-name alice \
  --bitcoin-node-name backend2
```

<!-- END GENERATED -->

## Notes

### Docker backend

- On Docker, the network must have only bitcoind and LND nodes, and no other compose services. Else the command gives `501 PolarToolNotSupported` or `409 ComposeFileHasOtherServices` before any change.
- The command writes the networks file and a new compose file.
- If the network is started, the command stops the LND node, changes the backend, and starts the node again. It returns after the node is online. Polar also waits, for all Lightning and bitcoind nodes of the network.
- The command does not check that the LND version supports the bitcoind version. To see the compatibility values, run [`list-node-versions`](list-node-versions.md).
- If the LND node already uses the bitcoind node, the command gives an error.
- On a stopped network, the command needs Docker only for a compose file that polarDocker did not write. For such a file, the compose check runs `docker compose config`.

### Polar app check

- In the Polar home, the check runs before the command, and again before each write of the networks file.
- On a started network, the stop of the node can be in effect at a `before-save` refusal. Then the new compose file and the start of the node can also be in effect.

### See also

- [`add-node`](add-node.md)
- [`list-node-versions`](list-node-versions.md)
- [Node kinds](../docker-backend.md#node-kinds)
