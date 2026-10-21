<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln sync-tap-universe

> Sync with Taproot Assets universe

## Usage

```sh
polarln sync-tap-universe --network-id <number> --node-name <string> \
  --universe-node-name <string>
```

## Flags

| Flag                   | Type   | Required | Description                             |
| ---------------------- | ------ | -------- | --------------------------------------- |
| `--network-id`         | number | yes      | ID of the network.                      |
| `--node-name`          | string | yes      | Name of the tapd or litd node.          |
| `--universe-node-name` | string | yes      | The name of the tapd node to sync with. |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: no (`501 PolarToolNotSupported`).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `syncTapUniverse`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await syncTapUniverse({
  polar,
  networkId: 1,
  nodeName: 'bob-tap',
  universeNodeName: 'alice-tap',
});
```

## Example

```sh
polarln sync-tap-universe --network-id 1 --node-name bob-tap \
  --universe-node-name alice-tap
```

<!-- END GENERATED -->

## Notes

- Docker: the Docker backend does not support this command. It gives `501 PolarToolNotSupported` before the [Polar app check](../polar-app.md#polar-app-check) and before any change. The Docker backend can start and stop a network with tapd and litd nodes, but it has no tapd or litd tools. Under auto, the CLI selects Docker if the Polar app does not run. Thus the Polar app must run for this command. See [Backends](../cli.md#backends).
- Node kinds: in Polar v4.0.0, `--node-name` and `--universe-node-name` can each be a tapd node or a litd node. The schema text names only tapd nodes for `--universe-node-name`. An LND, c-lightning, or eclair node gives `503 PolarToolFailed`.
- Host: Polar gives tapd the host `<name>:10029` for a tapd universe node, or `<name>:8443` for a litd universe node. These names and ports are inside the Docker network of the Polar network.
- Polar app: after the sync, Polar gets the assets and the balances of `--node-name` again, and keeps them in the app.
- Result: the result has `syncedAssets`. The value is the number of synced universes in the tapd answer. It is not a list of assets.
- [`fund-tap-channel`](fund-tap-channel.md) does a universe sync itself.

### See also

- [`get-tap-address`](get-tap-address.md)
- [`send-tap-asset`](send-tap-asset.md)
