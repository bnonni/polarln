<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln get-node-info

> Get information about a Lightning node including its public key, alias, sync status, block height, and channel counts. This provides essential node information for monitoring and debugging Lightning Network operations.

## Usage

```sh
polarln get-node-info --network-id <number> --node-name <string>
```

## Flags

| Flag           | Type   | Required | Description                                 |
| -------------- | ------ | -------- | ------------------------------------------- |
| `--network-id` | number | yes      | ID of the network.                          |
| `--node-name`  | string | yes      | Name of the Lightning node to get info for. |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: no. The command does not change files or containers.

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `getNodeInfo`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await getNodeInfo({polar, networkId: 1, nodeName: 'alice'});
```

## Example

```sh
polarln get-node-info --network-id 1 --node-name alice
```

<!-- END GENERATED -->

## Notes

### Node kinds

`--node-name` must be a Lightning node. The name of a node that is not a Lightning node, for example a tapd node, gives `404 PolarNodeNotFound`.

On Docker, the node must be an LND or litd node. A litd node uses its integrated lnd daemon, as in Polar. A c-lightning or eclair node gives `501 PolarToolNotSupported`. With the bridge, Polar also supports these nodes.

### Polar app

With the bridge, the Polar app also refreshes its data of the node. This fact comes from the Polar source. The command does not sync the chart.

### See also

- [`get-wallet-balance`](get-wallet-balance.md): get the on-chain balance of the node.
- [`list-channels`](list-channels.md): get the channels of the node.
- [`get-node-credentials`](get-node-credentials.md): get the credentials to connect your own client to the node.
