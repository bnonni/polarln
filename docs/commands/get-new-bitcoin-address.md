<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln get-new-bitcoin-address

> Generate new Bitcoin address for Lightning/Bitcoin nodes. This creates a new receiving address that can be used to receive on-chain Bitcoin payments.

## Usage

```sh
polarln get-new-bitcoin-address --network-id <number> [--node-name <string>]
```

## Flags

| Flag           | Type   | Required | Description                                                                                      |
| -------------- | ------ | -------- | ------------------------------------------------------------------------------------------------ |
| `--network-id` | number | yes      | ID of the network.                                                                               |
| `--node-name`  | string | no       | Name of the node to generate address for (optional, uses first available node if not specified). |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: no. The command does not change files or containers.

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `getNewBitcoinAddress`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await getNewBitcoinAddress({polar, networkId: 1, nodeName: 'alice'});
```

## Example

```sh
polarln get-new-bitcoin-address --network-id 1 --node-name alice
```

<!-- END GENERATED -->

## Notes

### Node kinds

The node can be a bitcoind, LND, or litd node. A litd node gives an address of its integrated lnd wallet, as in Polar.

With `--node-name`, the command looks for a bitcoind node first, and then for a Lightning node. If you do not give `--node-name`, the command uses the first bitcoind node. If the network has no bitcoind node, it uses the first Lightning node.

On Docker, a c-lightning or eclair node gives `501 PolarToolNotSupported`. With the bridge, Polar also supports these nodes. A tapd node is not a bitcoind node or a Lightning node, so the name of a tapd node gives `404 PolarNodeNotFound`.

### Result

The `nodeType` field of the result is `bitcoin` or `lightning`.

### See also

- [`send-bitcoin`](send-bitcoin.md): send coins from a bitcoind node to the address.
- [`deposit-funds`](deposit-funds.md): send coins to a Lightning node, and wait for the confirmation.
- [`get-tap-address`](get-tap-address.md): get a Taproot Assets address (bridge only).
