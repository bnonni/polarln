<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln decode-tap-address

> Decode Taproot Asset address

## Usage

```sh
polarln decode-tap-address --network-id <number> --node-name <string> \
  --address <string>
```

## Flags

| Flag           | Type   | Required | Description                          |
| -------------- | ------ | -------- | ------------------------------------ |
| `--network-id` | number | yes      | ID of the network.                   |
| `--node-name`  | string | yes      | Name of the tapd or litd node.       |
| `--address`    | string | yes      | The Taproot Asset address to decode. |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: no (`501 PolarToolNotSupported`).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `decodeTapAddress`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await decodeTapAddress({polar, networkId: 1, nodeName: 'bob-tap', address});
```

## Example

```sh
# $address: a Taproot Asset address, for example from get-tap-address
polarln decode-tap-address --network-id 1 --node-name bob-tap \
  --address "$address"
```

<!-- END GENERATED -->

## Notes

- Docker: the Docker backend does not support this command. It gives `501 PolarToolNotSupported` before the [Polar app check](../polar-app.md#polar-app-check) and before any change. The Docker backend can start and stop a network with tapd and litd nodes, but it has no tapd or litd tools. Under auto, the CLI selects Docker if the Polar app does not run. Thus the Polar app must run for this command. See [Backends](../cli.md#backends).
- Node kind: Polar v4.0.0 accepts a tapd node or a litd node. An LND, c-lightning, or eclair node gives `503 PolarToolFailed`, with the message `Node "<name>" is not a litd node`.
- Result: the result has `address`, `assetId`, `amount`, and `name`.
- Names and decimals: Polar v4.0.0 gets the name and the decimals of the asset from the asset list that the app keeps for `--node-name`. If this list does not have the asset, the result has no `name`, and `amount` is in the smallest units. To fill the list, run [`list-tap-assets`](list-tap-assets.md) on the node first.
- Amount: `amount` is a text with the decimals and a comma between groups of 3 digits, for example `1,000.00`. It is not a JSON number.

### See also

- [`get-tap-address`](get-tap-address.md)
- [`send-tap-asset`](send-tap-asset.md)
