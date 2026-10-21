<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln get-tap-balances

> Get all Taproot Asset balances for a specific tapd or litd node. Returns a list of assets with their balances. Works with tapd nodes and litd nodes (which include integrated tapd).

## Usage

```sh
polarln get-tap-balances --network-id <number> --node-name <string>
```

## Flags

| Flag           | Type   | Required | Description                                         |
| -------------- | ------ | -------- | --------------------------------------------------- |
| `--network-id` | number | yes      | ID of the network.                                  |
| `--node-name`  | string | yes      | Name of the tapd or litd node to get balances from. |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: no (`501 PolarToolNotSupported`).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `getTapBalances`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await getTapBalances({polar, networkId: 1, nodeName: 'alice-tap'});
```

## Example

```sh
polarln get-tap-balances --network-id 1 --node-name alice-tap
```

<!-- END GENERATED -->

## Notes

- Docker: the Docker backend does not support this command. It gives `501 PolarToolNotSupported` before the [Polar app check](../polar-app.md#polar-app-check) and before any change. The Docker backend can start and stop a network with tapd and litd nodes, but it has no tapd or litd tools. Under auto, the CLI selects Docker if the Polar app does not run. Thus the Polar app must run for this command. See [Backends](../cli.md#backends).
- Node kind: Polar v4.0.0 accepts a tapd node or a litd node. An LND, c-lightning, or eclair node gives `503 PolarToolFailed`, with the message `Node "<name>" is not a litd node`.
- Polar app: Polar v4.0.0 gets the balances from the node and keeps them in the app. Thus the Polar app shows the current assets of a tapd node in its sidebar. Use this command after a direct change with `tapcli`. See [Changes outside polarln](../polar-app.md#changes-outside-polarln).
- [`list-tap-assets`](list-tap-assets.md) does not refresh the sidebar, because the sidebar shows the balances.
- Result: the result has `balances`. Each balance has `id`, `name`, `type`, `balance`, and `genesisPoint`.

### See also

- [`mint-tap-asset`](mint-tap-asset.md)
- [`send-tap-asset`](send-tap-asset.md)
