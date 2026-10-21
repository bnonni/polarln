<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln deposit-funds

> Deposit Bitcoin from the network to a Lightning node on-chain wallet. This sends funds from the Bitcoin Core node to the Lightning node, then mines blocks to confirm the transaction. The deposited funds will be available in the Lightning node wallet for opening channels or on-chain transactions. Works with LND, c-lightning, eclair, and litd nodes.

## Usage

```sh
polarln deposit-funds --network-id <number> --node-name <string> \
  --sats <number>
```

## Flags

| Flag           | Type   | Required | Description                                     |
| -------------- | ------ | -------- | ----------------------------------------------- |
| `--network-id` | number | yes      | ID of the network.                              |
| `--node-name`  | string | yes      | Name of the Lightning node to deposit funds to. |
| `--sats`       | number | yes      | Amount in satoshis to deposit. Minimum: `1`.    |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: no. The command does not change files or containers.

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `depositFunds`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await depositFunds({polar, networkId: 1, nodeName: 'alice', sats: 1000000});
```

## Example

```sh
polarln deposit-funds --network-id 1 --node-name alice --sats 1000000
```

<!-- END GENERATED -->

## Notes

### Node kinds

`--node-name` must be a Lightning node. The name of a node that is not a Lightning node, for example a tapd node, gives `404 PolarNodeNotFound`.

On Docker, the node must be an LND or litd node. A litd node uses its integrated lnd daemon, as in Polar. A c-lightning or eclair node gives `501 PolarToolNotSupported`. With the bridge, Polar also supports these nodes.

### Funds

The coins come from the first bitcoind node of the network, not from the backend of the node. If the wallet of that node does not have enough coins, the node first mines new coins, as in [`send-bitcoin`](send-bitcoin.md). The command sends the coins to a new address of the node. Then it mines 6 blocks on the first bitcoind node. Polar does the same.

### Waits

On Docker, the command returns after the node shows the coins as confirmed. The wait is a maximum of 60 s. If the wait ends, the command fails with `503 PolarToolFailed`. With the bridge, Polar waits only 1 s after the mine for an LND or litd node.

### Polar app

With the bridge, the mine refreshes the Polar app, as [`mine-blocks`](mine-blocks.md) does. Then Polar also refreshes the wallet balance of the node. These facts come from the Polar source.

If the command runs on Docker while the Polar app runs, the app sees a direct change on the node. Then the LND sidebar keeps the old balance. See [Changes outside polarln](../polar-app.md#changes-outside-polarln).

### See also

- [`get-wallet-balance`](get-wallet-balance.md): get the on-chain balance of the node.
- [`open-channel`](open-channel.md): with `--auto-fund`, the command does the same deposit first.
- [Differences from the Polar app](../docker-backend.md#differences-from-the-polar-app): all waits of the Docker backend.
