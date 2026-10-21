<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln send-bitcoin

> Send on-chain Bitcoin transaction from a Bitcoin node to an address, optionally mining blocks to confirm the transaction.

## Usage

```sh
polarln send-bitcoin --network-id <number> --from-node <string> \
  --to-address <string> --amount <number> [--auto-mine]
```

## Flags

| Flag           | Type    | Required | Description                                                                         |
| -------------- | ------- | -------- | ----------------------------------------------------------------------------------- |
| `--network-id` | number  | yes      | ID of the network.                                                                  |
| `--from-node`  | string  | yes      | Name of the node sending the Bitcoin.                                               |
| `--to-address` | string  | yes      | Bitcoin address to send to.                                                         |
| `--amount`     | number  | yes      | Amount of Bitcoin to send (in bitcoin, so 0.00000001 is 1 satoshi).                 |
| `--auto-mine`  | boolean | no       | Whether to automatically mine 6 blocks to confirm the transaction (default: false). |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: no. The command does not change files or containers.

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `sendBitcoin`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await sendBitcoin({
  polar,
  networkId: 1,
  fromNode: 'backend1',
  toAddress: 'bcrt1qhmgzrkxhfahevdgexg875dl84j5dwume5dxyte',
  amount: 0.001,
  autoMine: true,
});
```

## Example

```sh
polarln send-bitcoin --network-id 1 --from-node backend1 \
  --to-address bcrt1qhmgzrkxhfahevdgexg875dl84j5dwume5dxyte --amount 0.001 \
  --auto-mine
```

<!-- END GENERATED -->

## Notes

### Node kinds

`--from-node` must be a bitcoind node. The name of a node that is not a bitcoind node gives `404 PolarNodeNotFound`. On Docker, the network can also have nodes of other kinds, for example tapd or c-lightning nodes.

`--to-address` can be any regtest address, for example an address from [`get-new-bitcoin-address`](get-new-bitcoin-address.md).

### Coins

If the wallet has `--amount` or less, the node first mines new coins, as in Polar. It mines until the wallet has coins that it can spend. Then it mines more blocks for the rest of the amount.

### Waits

The command does not wait for a confirmation. With `--auto-mine`, the node mines 6 blocks after the send, and the command waits 0.5 s. Polar does the same.

### Polar app

With the bridge and `--auto-mine`, the mine refreshes the Polar app, as [`mine-blocks`](mine-blocks.md) does. This fact comes from the Polar source.

If the command runs on Docker while the Polar app runs, the app sees a direct change on the node. Then the LND sidebar keeps the old balance. See [Changes outside polarln](../polar-app.md#changes-outside-polarln).

### See also

- [`get-new-bitcoin-address`](get-new-bitcoin-address.md): get an address to send to.
- [`deposit-funds`](deposit-funds.md): send coins to a Lightning node, and wait for the confirmation.
- [`get-bitcoin-wallet-info`](get-bitcoin-wallet-info.md): get the wallet balance of a bitcoind node.
