<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln get-wallet-balance

> Get the on-chain wallet balance for a Lightning node (LND, c-lightning, eclair, or litd). Returns the total, confirmed, and unconfirmed balances in satoshis. This shows the funds available in the node's on-chain Bitcoin wallet that can be used to open channels or for on-chain transactions. Note: This does not return channel balances - use list_channels to see balances within Lightning channels.

## Usage

```sh
polarln get-wallet-balance --network-id <number> --node-name <string>
```

## Flags

| Flag           | Type   | Required | Description                                    |
| -------------- | ------ | -------- | ---------------------------------------------- |
| `--network-id` | number | yes      | ID of the network.                             |
| `--node-name`  | string | yes      | Name of the Lightning node to get balance for. |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: no. The command does not change files or containers.

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `getWalletBalance`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await getWalletBalance({polar, networkId: 1, nodeName: 'alice'});
```

## Example

```sh
polarln get-wallet-balance --network-id 1 --node-name alice
```

<!-- END GENERATED -->

## Notes

### Node kinds

`--node-name` must be a Lightning node. The name of a node that is not a Lightning node, for example a tapd node, gives `404 PolarNodeNotFound`.

On Docker, the node must be an LND or litd node. A litd node uses its integrated lnd daemon, as in Polar. A c-lightning or eclair node gives `501 PolarToolNotSupported`. With the bridge, Polar also supports these nodes.

### Result

The `balance` field has the on-chain balances of the node in sats: `total`, `confirmed`, and `unconfirmed`. The values are strings. The channel balances are not in the result. To get them, use [`list-channels`](list-channels.md).

### Polar app

With the bridge, the Polar app also refreshes the wallet balance of the node in its data. This fact comes from the Polar source. The command does not sync the chart.

### See also

- [`deposit-funds`](deposit-funds.md): send coins to the node, and wait for the confirmation.
- [`list-channels`](list-channels.md): get the channel balances of the node.
- [`get-node-info`](get-node-info.md): get the info of the node.
