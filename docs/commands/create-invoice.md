<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln create-invoice

> Create a Lightning Network payment invoice for a node. Generates a payment request string (BOLT11 invoice) that can be paid by other Lightning nodes. The invoice contains the payment amount and an optional memo. Returns the payment request string that can be used with pay_invoice. Works with LND, c-lightning, eclair, and litd nodes.

## Usage

```sh
polarln create-invoice --network-id <number> --node-name <string> \
  --amount <number> [--memo <string>]
```

## Flags

| Flag           | Type   | Required | Description                                       |
| -------------- | ------ | -------- | ------------------------------------------------- |
| `--network-id` | number | yes      | ID of the network.                                |
| `--node-name`  | string | yes      | Name of the Lightning node to create invoice on.  |
| `--amount`     | number | yes      | Amount in satoshis for the invoice. Minimum: `1`. |
| `--memo`       | string | no       | Optional description/memo for the invoice.        |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: no. The command does not change files or containers.

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `createInvoice`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await createInvoice({
  polar,
  networkId: 1,
  nodeName: 'bob',
  amount: 50000,
  memo: 'coffee',
});
```

## Example

```sh
polarln create-invoice --network-id 1 --node-name bob --amount 50000 \
  --memo coffee
```

<!-- END GENERATED -->

## Notes

### Node kinds

`--node-name` must be a Lightning node. The name of a node that is not a Lightning node, for example a tapd node, gives `404 PolarNodeNotFound`.

On Docker, the node must be an LND or litd node. A litd node uses its integrated lnd daemon, as in Polar. A c-lightning or eclair node gives `501 PolarToolNotSupported`. With the bridge, Polar also supports these nodes.

### Result

The `invoice` field of the result is the BOLT11 payment request. Use it as `--invoice` of [`pay-invoice`](pay-invoice.md).

For an LND or litd node, the invoice has route hints for the private channels of the node. Thus a payment can use a private channel. Polar does the same.

### See also

- [`pay-invoice`](pay-invoice.md): pay the invoice from a different node.
- [`open-channel`](open-channel.md): open a private channel with `--is-private`.
- [`create-asset-invoice`](create-asset-invoice.md): make an invoice for a Taproot Asset (bridge only).
