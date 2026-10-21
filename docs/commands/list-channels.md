<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln list-channels

> List all Lightning Network channels for a specific node, including both channels initiated by the node and channels where the node is the peer. Returns information about each channel including status, balances, capacity, and whether the channel is pending, open, or closed. This is useful for checking channel connectivity and balance distribution.

## Usage

```sh
polarln list-channels --network-id <number> --node-name <string>
```

## Flags

| Flag           | Type   | Required | Description                                      |
| -------------- | ------ | -------- | ------------------------------------------------ |
| `--network-id` | number | yes      | ID of the network.                               |
| `--node-name`  | string | yes      | Name of the Lightning node to list channels for. |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: no. The command does not change files or containers.

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `listChannels`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await listChannels({polar, networkId: 1, nodeName: 'alice'});
```

## Example

```sh
polarln list-channels --network-id 1 --node-name alice
```

<!-- END GENERATED -->

## Notes

### Node kinds

`--node-name` must be a Lightning node. The name of a node that is not a Lightning node, for example a tapd node, gives `404 PolarNodeNotFound`.

On Docker, the node must be an LND or litd node. A litd node uses its integrated lnd daemon, as in Polar. A c-lightning or eclair node gives `501 PolarToolNotSupported`. With the bridge, Polar also supports these nodes.

### Result

The list has the channels that the node opened, and the channels that the other Lightning nodes opened to the node. For a channel that a different node opened, the command swaps the local and the remote balances. Thus the balances show the view of `--node-name`. Polar does the same.

The `status` of a channel is `Open`, `Opening`, `Closing`, `Force Closing`, or `Waiting to Close`.

The command skips a different node that does not answer, as in Polar. On Docker, the command also skips the c-lightning and eclair nodes. Thus the list does not have a channel that such a node opened to `--node-name`.

On Docker, the channels are in the order of the nodes in the network. In Polar, the order can change.

### Polar app

With the bridge, the Polar app also refreshes the node info and the channels of all Lightning nodes in its data. This fact comes from the Polar source. The command does not sync the chart, so the chart does not change.

### See also

- [`open-channel`](open-channel.md): open a channel.
- [`close-channel`](close-channel.md): close a channel with its channel point.
- [`get-node-info`](get-node-info.md): get the channel counts of a node.
