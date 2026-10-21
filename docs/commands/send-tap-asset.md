<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln send-tap-asset

> Send a Taproot Asset from a tapd or litd node to a given address. Set autoFund=true to automatically fund the node with Bitcoin if needed. Works with tapd nodes and litd nodes (which include integrated tapd).

## Usage

```sh
polarln send-tap-asset --network-id <number> --from-node <string> \
  --address <string> [--auto-fund]
```

## Flags

| Flag           | Type    | Required | Description                                                                                        |
| -------------- | ------- | -------- | -------------------------------------------------------------------------------------------------- |
| `--network-id` | number  | yes      | ID of the network.                                                                                 |
| `--from-node`  | string  | yes      | Name of the tapd or litd node to send the asset from.                                              |
| `--address`    | string  | yes      | The Taproot Asset address to send to.                                                              |
| `--auto-fund`  | boolean | no       | Whether to automatically fund the LND node with Bitcoin if needed. Use `--no-auto-fund` for false. |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: no (`501 PolarToolNotSupported`).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `sendTapAsset`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await sendTapAsset({
  polar,
  networkId: 1,
  fromNode: 'alice-tap',
  address,
  autoFund: true,
});
```

## Example

```sh
# $address: a Taproot Asset address, for example from get-tap-address
polarln send-tap-asset --network-id 1 --from-node alice-tap \
  --address "$address" --auto-fund
```

<!-- END GENERATED -->

## Notes

- Docker: the Docker backend does not support this command. It gives `501 PolarToolNotSupported` before the [Polar app check](../polar-app.md#polar-app-check) and before any change. The Docker backend can start and stop a network with tapd and litd nodes, but it has no tapd or litd tools. Under auto, the CLI selects Docker if the Polar app does not run. Thus the Polar app must run for this command. See [Backends](../cli.md#backends).
- Node kind: Polar v4.0.0 accepts a tapd node or a litd node. An LND, c-lightning, or eclair node gives `503 PolarToolFailed`, with the message `Node "<name>" is not a litd node`.
- Auto fund: `--auto-fund` is true by default. Then Polar v4.0.0 deposits 1,000,000 sats to the LND node of the tapd node, or to the litd node. The deposit occurs at each call, also if the node has funds. The coins come from the first bitcoind node of the network, and Polar mines 6 blocks. To send with the current funds of the node, use `--no-auto-fund`.
- Steps after the send: Polar mines 6 blocks. Then it reads the balances of `--from-node` again, up to 10 times with 1 s between the reads. It stops when the balance of the asset changes.
- Address: `--address` is the `encoded` value of [`get-tap-address`](get-tap-address.md) on the receiver node.
- Result: the result has `transfer`, with the answer of tapd.

### See also

- [`decode-tap-address`](decode-tap-address.md)
- [`get-tap-balances`](get-tap-balances.md)
