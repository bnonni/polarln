<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln list-tap-assets

> List all Taproot Assets for a specific tapd or litd node. Returns asset details including ID, name, type, amount, genesis point, and decimals. Works with tapd nodes and litd nodes (which include integrated tapd).

## Usage

```sh
polarln list-tap-assets --network-id <number> --node-name <string>
```

## Flags

| Flag           | Type   | Required | Description                                        |
| -------------- | ------ | -------- | -------------------------------------------------- |
| `--network-id` | number | yes      | ID of the network.                                 |
| `--node-name`  | string | yes      | Name of the tapd or litd node to list assets from. |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: no (`501 PolarToolNotSupported`).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `listTapAssets`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await listTapAssets({polar, networkId: 1, nodeName: 'alice-tap'});
```

## Example

```sh
polarln list-tap-assets --network-id 1 --node-name alice-tap
```

<!-- END GENERATED -->

## Notes

- Docker: the Docker backend does not support this command. It gives `501 PolarToolNotSupported` before the [Polar app check](../polar-app.md#polar-app-check) and before any change. The Docker backend can start and stop a network with tapd and litd nodes, but it has no tapd or litd tools. Under auto, the CLI selects Docker if the Polar app does not run. Thus the Polar app must run for this command. See [Backends](../cli.md#backends).
- Node kind: Polar v4.0.0 accepts a tapd node or a litd node. An LND, c-lightning, or eclair node gives `503 PolarToolFailed`, with the message `Node "<name>" is not a litd node`.
- Polar app: Polar v4.0.0 gets the assets from the node and keeps the list in the app. The tapd sidebar shows the balances, not this list. Thus this command does not refresh the sidebar. To refresh the sidebar, use [`get-tap-balances`](get-tap-balances.md).
- Result: the result has `networkId`, `assets`, and `totalCount`. Each asset has `id`, `name`, `type`, `amount`, `genesisPoint`, `anchorOutpoint`, `groupKey`, `decimals`, and `nodeName`.
- Asset ID: the `id` of an asset is the hex value for the `--asset-id` flag of the other commands.
- Names: [`decode-tap-address`](decode-tap-address.md) gets the name and the decimals of an asset from the list that this command keeps in the app.

### See also

- [`mint-tap-asset`](mint-tap-asset.md)
- [`get-tap-balances`](get-tap-balances.md)
