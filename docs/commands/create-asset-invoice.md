<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln create-asset-invoice

> Create a Lightning invoice payable with Taproot Assets from a litd node. The node must have sufficient assets in channels to create the invoice. Works only with litd nodes (which include integrated LND + Lightning Terminal + tapd).

## Usage

```sh
polarln create-asset-invoice --network-id <number> --node-name <string> \
  --asset-id <string> --amount <number>
```

## Flags

| Flag           | Type   | Required | Description                                       |
| -------------- | ------ | -------- | ------------------------------------------------- |
| `--network-id` | number | yes      | ID of the network.                                |
| `--node-name`  | string | yes      | Name of the litd node to create the invoice from. |
| `--asset-id`   | string | yes      | ID of the Taproot Asset to create invoice for.    |
| `--amount`     | number | yes      | Amount of the asset to invoice for.               |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: no (`501 PolarToolNotSupported`).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `createAssetInvoice`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await createAssetInvoice({
  polar,
  networkId: 1,
  nodeName: 'bob',
  assetId: 'f6fdd831fbb17a658516c31364e7a442189b8745910bed1a839614d87e5dee73',
  amount: 100,
});
```

## Example

```sh
polarln create-asset-invoice --network-id 1 --node-name bob \
  --asset-id f6fdd831fbb17a658516c31364e7a442189b8745910bed1a839614d87e5dee73 \
  --amount 100
```

<!-- END GENERATED -->

## Notes

- Docker: the Docker backend does not support this command. It gives `501 PolarToolNotSupported` before the [Polar app check](../polar-app.md#polar-app-check) and before any change. The Docker backend can start and stop a network with tapd and litd nodes, but it has no tapd or litd tools. Under auto, the CLI selects Docker if the Polar app does not run. Thus the Polar app must run for this command. See [Backends](../cli.md#backends).
- Node kind: Polar v4.0.0 accepts only a litd node. An LND, c-lightning, or eclair node gives `503 PolarToolFailed`, with the message `Node "<name>" is not a litd node (implementation: <kind>)`. A tapd or bitcoind node gives `404 PolarNodeNotFound`, because Polar looks only in the Lightning nodes.
- Channel data: Polar checks the channel data that the app keeps. A channel of the node must have the asset, with a remote balance of at least `--amount`. Else the command gives `503 PolarToolFailed`, with the message `Not enough assets in a channel to create the invoice`. To refresh the channel data, run [`list-channels`](list-channels.md) first.
- Units: `--asset-id` is the hex asset ID. `--amount` is in the smallest units of the asset.
- Invoice: tapd makes the invoice with an expiry of 3,600 s (1 hour) and no memo.
- Result: the result has `invoice` and `sats`. `sats` is the amount of the invoice in sats.

### See also

- [`pay-asset-invoice`](pay-asset-invoice.md)
- [`get-assets-in-channels`](get-assets-in-channels.md)
- [`fund-tap-channel`](fund-tap-channel.md)
