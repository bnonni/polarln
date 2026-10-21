<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln set-tap-backend

> Changes the LND backend node for a Taproot Assets (TAP) node. This reassigns which LND node the TAP node will connect to as its backend.

## Usage

```sh
polarln set-tap-backend --network-id <number> --tap-node-name <string> \
  --lnd-node-name <string>
```

## Flags

| Flag              | Type   | Required | Description                                           |
| ----------------- | ------ | -------- | ----------------------------------------------------- |
| `--network-id`    | number | yes      | ID of the network containing the nodes.               |
| `--tap-node-name` | string | yes      | Name of the TAP node whose backend should be changed. |
| `--lnd-node-name` | string | yes      | Name of the LND node to set as the backend.           |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: no (`501 PolarToolNotSupported`).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `setTapBackend`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await setTapBackend({
  polar,
  networkId: 1,
  tapNodeName: 'alice-tap',
  lndNodeName: 'bob',
});
```

## Example

```sh
polarln set-tap-backend --network-id 1 --tap-node-name alice-tap \
  --lnd-node-name bob
```

<!-- END GENERATED -->

## Notes

- The Docker backend does not have this command. On Docker, the command gives `501 PolarToolNotSupported` and makes no change.
- The command needs the Polar app. Under the auto backend, the CLI uses the bridge if the Polar app answers. Else the command runs on Docker and gives `501`.
- On Docker, a network with a tapd node also gives `501` for the commands that change nodes: `add-node`, `remove-node`, `rename-node`, `update-node-command`, and `set-lightning-backend`.

### See also

- [`set-lightning-backend`](set-lightning-backend.md)
- [Node kinds](../docker-backend.md#node-kinds)
- [Backends](../cli.md#backends)
