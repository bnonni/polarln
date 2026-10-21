<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln open-channel

> Open a Lightning Network channel between two nodes in a Polar network. This creates a payment channel with the specified capacity. You can optionally set the channel as private and auto-fund the source node if it lacks sufficient balance.

## Usage

```sh
polarln open-channel --network-id <number> --from-node <string> \
  --to-node <string> --sats <number> [--is-private] [--auto-fund]
```

## Flags

| Flag           | Type    | Required | Description                                                                                                                   |
| -------------- | ------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `--network-id` | number  | yes      | ID of the network.                                                                                                            |
| `--from-node`  | string  | yes      | Name of the source Lightning node (the one funding the channel).                                                              |
| `--to-node`    | string  | yes      | Name of the destination Lightning node.                                                                                       |
| `--sats`       | number  | yes      | Channel capacity in satoshis.                                                                                                 |
| `--is-private` | boolean | no       | Whether the channel should be private (not announced to the network). Default: false.                                         |
| `--auto-fund`  | boolean | no       | Automatically deposit funds to the source node if it lacks sufficient balance. Default: true. Use `--no-auto-fund` for false. |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: no. The command does not change files or containers.

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `openChannel`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await openChannel({
  polar,
  networkId: 1,
  fromNode: 'alice',
  toNode: 'bob',
  sats: 250000,
});
```

## Example

```sh
polarln open-channel --network-id 1 --from-node alice --to-node bob \
  --sats 250000
```

<!-- END GENERATED -->

## Notes

### Node kinds

The 2 nodes must be Lightning nodes with different names. The same name for the 2 nodes gives `400 PolarRejectedArguments`. The name of a node that is not a Lightning node, for example a tapd node, gives `404 PolarNodeNotFound`.

On Docker, the 2 nodes must be LND or litd nodes. A litd node uses its integrated lnd daemon, as in Polar. A c-lightning or eclair node gives `501 PolarToolNotSupported`. With the bridge, Polar also supports these nodes.

For a Taproot Assets channel, use [`fund-tap-channel`](fund-tap-channel.md) (bridge only).

### Funds

With `--auto-fund` (the default), the command always deposits 2 times `--sats` to the source node first. It does this also if the node has enough coins. Polar does the same, but the flag description says "if it lacks sufficient balance". The deposit comes from the first bitcoind node, as in [`deposit-funds`](deposit-funds.md). To use only the coins of the source node, add `--no-auto-fund`.

### Waits

After the open, the command waits 0.5 s. Then it mines 6 blocks on the bitcoind backend of the source node.

On Docker, the command returns after the 2 nodes can use the channel for payments. Each node must show the channel as active, and the graph of each node must have the policies of the 2 nodes. The wait is a maximum of 60 s for each node. If the wait ends, the command fails with `503 PolarToolFailed`. With `--auto-fund`, the deposit also waits until the source node shows the coins as confirmed.

With the bridge, Polar waits only 1 s after the mine for LND and litd nodes. Thus the first payment over the new channel can fail.

### Result

The `channelPoint` field of the result has the format `txid:vout`. Use it as `--channel-point` of [`close-channel`](close-channel.md).

### Polar app

With the bridge, the command syncs the chart, so the chart shows the new channel. A live test with Polar v4.0.0 showed this result. Polar skips a chart sync less than 5 s after the last sync. Each chart sync clears a channel selection in the sidebar.

If the command runs on Docker while the Polar app runs, the app sees a direct change on the node. The mine comes less than 5 s after the open, so the chart can keep a dashed line. See [Changes outside polarln](../polar-app.md#changes-outside-polarln).

### See also

- [`list-channels`](list-channels.md): show the new channel and its balances.
- [`pay-invoice`](pay-invoice.md): pay over the channel.
- [`close-channel`](close-channel.md): close the channel.
- [Differences from the Polar app](../docker-backend.md#differences-from-the-polar-app): all waits of the Docker backend.
