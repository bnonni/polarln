<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln get-assets-in-channels

> Get all Taproot Assets available in Lightning channels for a litd node. Returns assets with their balances and peer information. Works only with litd nodes (which include integrated LND + Lightning Terminal + tapd).

## Usage

```sh
polarln get-assets-in-channels --network-id <number> --node-name <string>
```

## Flags

| Flag           | Type   | Required | Description                                          |
| -------------- | ------ | -------- | ---------------------------------------------------- |
| `--network-id` | number | yes      | ID of the network.                                   |
| `--node-name`  | string | yes      | Name of the litd node to get assets in channels for. |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: no (`501 PolarToolNotSupported`).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `getAssetsInChannels`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await getAssetsInChannels({polar, networkId: 1, nodeName: 'alice'});
```

## Example

```sh
polarln get-assets-in-channels --network-id 1 --node-name alice
```

<!-- END GENERATED -->

## Notes

- Docker: the Docker backend does not support this command. It gives `501 PolarToolNotSupported` before the [Polar app check](../polar-app.md#polar-app-check) and before any change. The Docker backend can start and stop a network with tapd and litd nodes, but it has no tapd or litd tools. Under auto, the CLI selects Docker if the Polar app does not run. Thus the Polar app must run for this command. See [Backends](../cli.md#backends).
- Node kind: Polar v4.0.0 accepts only a litd node. An LND, c-lightning, or eclair node gives `503 PolarToolFailed`, with the message `Node "<name>" is not a litd node (implementation: <kind>)`. A tapd or bitcoind node gives `404 PolarNodeNotFound`, because Polar looks only in the Lightning nodes.
- Channel data: Polar reads the channel data that the app keeps. It does not ask the node. Thus the result can be old after a direct change on a node. To refresh the channel data, run [`list-channels`](list-channels.md) first. Polar then gets the channels of all Lightning nodes of the network.
- Result: the result has `assetsInChannels`. Each item has `asset` and `peerPubkey`. The `asset` has `id`, `name`, `capacity`, `localBalance`, `remoteBalance`, and `decimals`.
- One item for each asset: if 2 channels have the same asset, the list shows only the channel with the highest local balance.
- [`create-asset-invoice`](create-asset-invoice.md) and [`pay-asset-invoice`](pay-asset-invoice.md) use the same channel data.

### See also

- [`fund-tap-channel`](fund-tap-channel.md)
