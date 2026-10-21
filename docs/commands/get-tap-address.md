<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln get-tap-address

> Generate Taproot Asset address

## Usage

```sh
polarln get-tap-address --network-id <number> --node-name <string> \
  --asset-id <string> --amount <string>
```

## Flags

| Flag           | Type   | Required | Description                            |
| -------------- | ------ | -------- | -------------------------------------- |
| `--network-id` | number | yes      | ID of the network.                     |
| `--node-name`  | string | yes      | Name of the tapd or litd node.         |
| `--asset-id`   | string | yes      | The asset ID to create an address for. |
| `--amount`     | string | yes      | The amount of the asset to send.       |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: no (`501 PolarToolNotSupported`).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `getTapAddress`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await getTapAddress({
  polar,
  networkId: 1,
  nodeName: 'bob-tap',
  assetId: 'f6fdd831fbb17a658516c31364e7a442189b8745910bed1a839614d87e5dee73',
  amount: '500',
});
```

## Example

```sh
polarln get-tap-address --network-id 1 --node-name bob-tap \
  --asset-id f6fdd831fbb17a658516c31364e7a442189b8745910bed1a839614d87e5dee73 \
  --amount 500
```

<!-- END GENERATED -->

## Notes

- Docker: the Docker backend does not support this command. It gives `501 PolarToolNotSupported` before the [Polar app check](../polar-app.md#polar-app-check) and before any change. The Docker backend can start and stop a network with tapd and litd nodes, but it has no tapd or litd tools. Under auto, the CLI selects Docker if the Polar app does not run. Thus the Polar app must run for this command. See [Backends](../cli.md#backends).
- Node kind: Polar v4.0.0 accepts a tapd node or a litd node. An LND, c-lightning, or eclair node gives `503 PolarToolFailed`, with the message `Node "<name>" is not a litd node`.
- Amount: `--amount` is a string flag, but it takes a number of units. Polar v4.0.0 gives the value to tapd with no change, so the value is in the smallest units of the asset. The address dialog of the Polar app applies the decimals, but this command does not.
- Asset ID: `--asset-id` is the hex asset ID, as the `id` of an asset in [`list-tap-assets`](list-tap-assets.md).
- Result: the `encoded` key has the address. Give it to [`send-tap-asset`](send-tap-asset.md) as `--address`. The result also has `id`, `type`, `amount`, `family`, `scriptKey`, `internalKey`, and `taprootOutputKey`.
- Universe: the address dialog of the Polar app has an action to sync the universe with a different node. With polarln, use [`sync-tap-universe`](sync-tap-universe.md) for this step.

### See also

- [`decode-tap-address`](decode-tap-address.md)
