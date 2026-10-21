<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln mint-tap-asset

> Mint a new Taproot Asset on a tapd or litd node. Creates a new asset with the specified parameters. For normal assets, you can specify an amount and decimals. For collectibles, the amount is always 1. Set finalize=true to automatically finalize the batch and mine blocks to confirm. Set autoFund=true to automatically fund the node with Bitcoin if needed. Works with tapd nodes and litd nodes (which include integrated tapd).

## Usage

```sh
polarln mint-tap-asset --network-id <number> --node-name <string> \
  --asset-type <string> --name <string> --amount <number> \
  [--decimals <number>] [--enable-emission] [--finalize] [--auto-fund]
```

## Flags

| Flag                | Type    | Required | Description                                                                                                                                                                                                                                |
| ------------------- | ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--network-id`      | number  | yes      | ID of the network.                                                                                                                                                                                                                         |
| `--node-name`       | string  | yes      | Name of the tapd or litd node to mint the asset on.                                                                                                                                                                                        |
| `--asset-type`      | string  | yes      | Type of asset: "normal" for fungible assets, "collectible" for NFTs. Values: `normal`, `collectible`.                                                                                                                                      |
| `--name`            | string  | yes      | Name of the asset.                                                                                                                                                                                                                         |
| `--amount`          | number  | yes      | Amount to mint (ignored for collectibles, which are always 1). Minimum: `1`.                                                                                                                                                               |
| `--decimals`        | number  | no       | Number of decimal places for the asset (default: 0, max: 8). Only for normal assets. The amount must be the total number of units in the supply, so 10000 amount with 2 decimals would be displayed as 100.00. Minimum: `0`. Maximum: `8`. |
| `--enable-emission` | boolean | no       | Whether to enable future emission for this asset (creates an asset group). Use `--no-enable-emission` for false.                                                                                                                           |
| `--finalize`        | boolean | no       | Whether to finalize the batch immediately and mine blocks to confirm. Use `--no-finalize` for false.                                                                                                                                       |
| `--auto-fund`       | boolean | no       | Whether to automatically fund the LND node with Bitcoin if needed. Use `--no-auto-fund` for false.                                                                                                                                         |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: no (`501 PolarToolNotSupported`).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `mintTapAsset`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await mintTapAsset({
  polar,
  networkId: 1,
  nodeName: 'alice-tap',
  assetType: 'normal',
  name: 'usd',
  amount: 100000,
  decimals: 2,
  finalize: true,
  autoFund: true,
});
```

## Example

```sh
polarln mint-tap-asset --network-id 1 --node-name alice-tap \
  --asset-type normal --name usd --amount 100000 --decimals 2 --finalize \
  --auto-fund
```

<!-- END GENERATED -->

## Notes

- Docker: the Docker backend does not support this command. It gives `501 PolarToolNotSupported` before the [Polar app check](../polar-app.md#polar-app-check) and before any change. The Docker backend can start and stop a network with tapd and litd nodes, but it has no tapd or litd tools. Under auto, the CLI selects Docker if the Polar app does not run. Thus the Polar app must run for this command. See [Backends](../cli.md#backends).
- Node kind: Polar v4.0.0 accepts a tapd node or a litd node. An LND, c-lightning, or eclair node gives `503 PolarToolFailed`, with the message `Node "<name>" is not a litd node`.
- Defaults: if you do not give a flag, Polar v4.0.0 uses these values:

  | Flag                | Value |
  | ------------------- | ----- |
  | `--decimals`        | 0     |
  | `--enable-emission` | false |
  | `--finalize`        | true  |
  | `--auto-fund`       | true  |

  The schema text says "Set finalize=true", but Polar finalizes the batch by default. If you do not want to finalize the batch, use `--no-finalize`.

- Auto fund: Polar deposits 1,000,000 sats to the LND node of the tapd node, or to the litd node. The deposit occurs at each call with auto fund, also if the node has funds. The coins come from the first bitcoind node of the network, and Polar mines 6 blocks.
- Finalize: Polar finalizes the batch and starts a mine of 6 blocks. It does not wait for the mine. Thus the result can come before the blocks.
- Result: the result has the `batchKey` of the batch. For a collectible, Polar mints 1 unit, and the result has `amount: 1`.
- Polar app: after a finalized mint, the Polar app shows the new asset in the tapd sidebar. A mint with `tapcli` does not show in the app. See [Changes outside polarln](../polar-app.md#changes-outside-polarln).

### See also

- [`list-tap-assets`](list-tap-assets.md) to get the asset ID
- [`get-tap-balances`](get-tap-balances.md)
