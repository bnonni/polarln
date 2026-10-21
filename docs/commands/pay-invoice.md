<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln pay-invoice

> Pay a Lightning Network payment invoice from a specific node. The invoice is a BOLT11 payment request string. An optional amount can be provided for invoices without a specific amount. Returns a payment receipt with the preimage and fees paid. Works with LND, c-lightning, eclair, and litd nodes.

## Usage

```sh
polarln pay-invoice --network-id <number> --from-node <string> \
  --invoice <string> [--amount <number>]
```

## Flags

| Flag           | Type   | Required | Description                                                                                 |
| -------------- | ------ | -------- | ------------------------------------------------------------------------------------------- |
| `--network-id` | number | yes      | ID of the network.                                                                          |
| `--from-node`  | string | yes      | Name of the Lightning node to pay the invoice from.                                         |
| `--invoice`    | string | yes      | The BOLT11 payment request string to pay.                                                   |
| `--amount`     | number | no       | Optional amount in satoshis to pay for an invoice without a specified amount. Minimum: `1`. |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: no. The command does not change files or containers.

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `payInvoice`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await payInvoice({polar, networkId: 1, fromNode: 'alice', invoice});
```

## Example

```sh
# $invoice: a BOLT11 invoice, for example from create-invoice
polarln pay-invoice --network-id 1 --from-node alice --invoice "$invoice"
```

<!-- END GENERATED -->

## Notes

### Node kinds

`--from-node` must be a Lightning node. The name of a node that is not a Lightning node, for example a tapd node, gives `404 PolarNodeNotFound`.

On Docker, the node must be an LND or litd node. A litd node uses its integrated lnd daemon, as in Polar. A c-lightning or eclair node gives `501 PolarToolNotSupported`. With the bridge, Polar also supports these nodes.

### Payment

For an LND or litd node, these rules apply on the 2 backends:

- If the invoice has an amount, the command ignores `--amount`.
- The fee limit is 1000 sats. If `--amount` is more than 1000 sats, the fee limit is 5% of `--amount`.
- The payment can use a maximum of 16 parts. It has a timeout of 60 s.

On Docker, a payment with the status `FAILED` gives `503 PolarToolFailed`, and `details.err` has the lnd failure reason.

### Waits

On Docker, the command waits 1 s after the payment succeeds. With the bridge, Polar waits 1 s if the network has only LND and litd nodes. If the network has c-lightning or eclair nodes, Polar waits 2 s.

### Polar app

With the bridge, the command syncs the chart, so the chart shows the new channel balances. The sync also closes the channel sidebar. A live test with Polar v4.0.0 showed these results. Polar skips a chart sync less than 5 s after the last sync.

If the command runs on Docker while the Polar app runs, the app sees a direct change on the node. Then the app shows the new channel balances only after the next chart sync. See [Changes outside polarln](../polar-app.md#changes-outside-polarln).

### See also

- [`create-invoice`](create-invoice.md): make an invoice to pay.
- [`list-channels`](list-channels.md): get the channel balances after the payment.
- [`pay-asset-invoice`](pay-asset-invoice.md): pay an invoice with a Taproot Asset (bridge only).
