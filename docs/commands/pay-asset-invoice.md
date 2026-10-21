<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln pay-asset-invoice

> Pay a Lightning invoice using Taproot Assets from a litd node. The node must have sufficient assets in channels to pay the invoice. Works only with litd nodes (which include integrated LND + Lightning Terminal + tapd).

## Usage

```sh
polarln pay-asset-invoice --network-id <number> --from-node <string> \
  --asset-id <string> --invoice <string>
```

## Flags

| Flag           | Type   | Required | Description                                    |
| -------------- | ------ | -------- | ---------------------------------------------- |
| `--network-id` | number | yes      | ID of the network.                             |
| `--from-node`  | string | yes      | Name of the litd node to pay the invoice from. |
| `--asset-id`   | string | yes      | ID of the Taproot Asset to use for payment.    |
| `--invoice`    | string | yes      | The Lightning invoice string to pay.           |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: no (`501 PolarToolNotSupported`).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `payAssetInvoice`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await payAssetInvoice({
  polar,
  networkId: 1,
  fromNode: 'alice',
  assetId: 'f6fdd831fbb17a658516c31364e7a442189b8745910bed1a839614d87e5dee73',
  invoice,
});
```

## Example

```sh
# $invoice: a BOLT11 invoice, for example from create-invoice
polarln pay-asset-invoice --network-id 1 --from-node alice \
  --asset-id f6fdd831fbb17a658516c31364e7a442189b8745910bed1a839614d87e5dee73 \
  --invoice "$invoice"
```

<!-- END GENERATED -->

## Notes

- Docker: the Docker backend does not support this command. It gives `501 PolarToolNotSupported` before the [Polar app check](../polar-app.md#polar-app-check) and before any change. The Docker backend can start and stop a network with tapd and litd nodes, but it has no tapd or litd tools. Under auto, the CLI selects Docker if the Polar app does not run. Thus the Polar app must run for this command. See [Backends](../cli.md#backends).
- Node kind: Polar v4.0.0 accepts only a litd node. An LND, c-lightning, or eclair node gives `503 PolarToolFailed`, with the message `Node "<name>" is not a litd node (implementation: <kind>)`. A tapd or bitcoind node gives `404 PolarNodeNotFound`, because Polar looks only in the Lightning nodes.
- Channel data: Polar checks the channel data that the app keeps. A channel of the node must have the asset. Else the command gives `503 PolarToolFailed`, with the message `Not enough assets in a channel to pay the invoice`. Polar does not compare the balance with the amount of the invoice. To refresh the channel data, run [`list-channels`](list-channels.md) first.
- Route: Polar pays through the peer of the asset channel with the highest local balance of the asset.
- Fee limit: if the invoice amount is more than 1,000 sats, the fee limit is 5% of the amount. Else the fee limit is the full amount.
- Steps after the payment: Polar waits for the Lightning nodes and syncs the chart. Polar does not sync the chart if the last sync was less than 5 s before. See [Changes outside polarln](../polar-app.md#changes-outside-polarln).
- Result: the result has `receipt`, with the payment receipt of tapd.

### See also

- [`create-asset-invoice`](create-asset-invoice.md)
- [`get-assets-in-channels`](get-assets-in-channels.md)
