<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln fund-tap-channel

> Fund a Lightning Network channel with Taproot Assets between two litd nodes. This creates an asset-enabled payment channel using the specified asset as collateral. The asset must exist on the source node and will be locked in the channel. Works with litd nodes only (which include integrated LND + tapd).

## Usage

```sh
polarln fund-tap-channel --network-id <number> --from-node <string> \
  --to-node <string> --asset-id <string> --amount <number>
```

## Flags

| Flag           | Type   | Required | Description                                                 |
| -------------- | ------ | -------- | ----------------------------------------------------------- |
| `--network-id` | number | yes      | ID of the network.                                          |
| `--from-node`  | string | yes      | Name of the source litd node (the one holding the asset).   |
| `--to-node`    | string | yes      | Name of the destination litd node.                          |
| `--asset-id`   | string | yes      | Asset ID of the Taproot Asset to use for funding.           |
| `--amount`     | number | yes      | Amount of the asset to fund the channel with. Minimum: `1`. |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: no (`501 PolarToolNotSupported`).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `fundTapChannel`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await fundTapChannel({
  polar,
  networkId: 1,
  fromNode: 'alice',
  toNode: 'bob',
  assetId: 'f6fdd831fbb17a658516c31364e7a442189b8745910bed1a839614d87e5dee73',
  amount: 1000,
});
```

## Example

```sh
polarln fund-tap-channel --network-id 1 --from-node alice --to-node bob \
  --asset-id f6fdd831fbb17a658516c31364e7a442189b8745910bed1a839614d87e5dee73 \
  --amount 1000
```

<!-- END GENERATED -->

## Notes

- Docker: the Docker backend does not support this command. It gives `501 PolarToolNotSupported` before the [Polar app check](../polar-app.md#polar-app-check) and before any change. The Docker backend can start and stop a network with tapd and litd nodes, but it has no tapd or litd tools. Under auto, the CLI selects Docker if the Polar app does not run. Thus the Polar app must run for this command. See [Backends](../cli.md#backends).
- Node kinds: use 2 different litd nodes. Polar v4.0.0 rejects a `--to-node` that is not a litd node. If `--from-node` and `--to-node` are the same node, the command gives `400 PolarRejectedArguments`.
- Units: `--asset-id` is the hex asset ID, as the `id` of an asset in [`list-tap-assets`](list-tap-assets.md). `--amount` is in the smallest units of the asset. Polar does not apply the decimals of the asset.
- Steps: Polar does these steps, and the command returns after the last step:
  1. If the app has the asset balance of `--from-node`, Polar checks that `--amount` is not more than this balance. Else the command gives `400 PolarRejectedArguments`.
  2. `--to-node` syncs its universe with `--from-node`, so that it knows the asset.
  3. tapd funds the channel with a fee rate of 50 sat/vB. It also pushes 5,000 sats to the peer, so that the peer can send assets back at once.
  4. Polar mines 6 blocks and syncs the chart.
- Chart: Polar does not sync the chart if the last sync was less than 5 s before. See [Changes outside polarln](../polar-app.md#changes-outside-polarln).

### See also

- [`close-tap-channel`](close-tap-channel.md)
- [`get-assets-in-channels`](get-assets-in-channels.md)
- [`create-asset-invoice`](create-asset-invoice.md)
- [`pay-asset-invoice`](pay-asset-invoice.md)
