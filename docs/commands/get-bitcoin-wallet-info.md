<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln get-bitcoin-wallet-info

> Get wallet information from a Bitcoin node including the total balance and transaction count. Returns the current wallet balance in BTC and the total number of transactions in the wallet.

## Usage

```sh
polarln get-bitcoin-wallet-info --network-id <number> [--node-name <string>]
```

## Flags

| Flag           | Type   | Required | Description                                                                     |
| -------------- | ------ | -------- | ------------------------------------------------------------------------------- |
| `--network-id` | number | yes      | ID of the network.                                                              |
| `--node-name`  | string | no       | Name of the Bitcoin node to query (optional, uses first node if not specified). |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: no. The command does not change files or containers.

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `getBitcoinWalletInfo`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await getBitcoinWalletInfo({polar, networkId: 1, nodeName: 'backend1'});
```

## Example

```sh
polarln get-bitcoin-wallet-info --network-id 1 --node-name backend1
```

<!-- END GENERATED -->

## Notes

### Node kinds

The command uses a bitcoind node. If you do not give `--node-name`, it uses the first bitcoind node of the network. The name of a node that is not a bitcoind node gives `404 PolarNodeNotFound`. On Docker, the network can also have nodes of other kinds, for example tapd or c-lightning nodes.

### Result

The balances are in BTC. As in Polar, the `balance`, `unconfirmed_balance`, and `immature_balance` fields come from the bitcoind `getbalances` call. The `getwalletinfo` call of bitcoind v30 does not show these fields.

### Polar app

With the bridge, the Polar app also refreshes its data of the bitcoind node, as [`get-blockchain-info`](get-blockchain-info.md) does. This fact comes from the Polar source. The live test did not check it.

### See also

- [`send-bitcoin`](send-bitcoin.md): send coins from the wallet of a bitcoind node.
- [`get-new-bitcoin-address`](get-new-bitcoin-address.md): get a new address of the wallet.
- [`mine-blocks`](mine-blocks.md): mine blocks to the wallet.
