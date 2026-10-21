<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln close-channel

> Close a Lightning Network channel in a Polar network. This cooperatively closes the specified channel and returns the funds to the on-chain wallet.

## Usage

```sh
polarln close-channel --network-id <number> --node-name <string> \
  --channel-point <string>
```

## Flags

| Flag              | Type   | Required | Description                                                                          |
| ----------------- | ------ | -------- | ------------------------------------------------------------------------------------ |
| `--network-id`    | number | yes      | ID of the network.                                                                   |
| `--node-name`     | string | yes      | Name of the Lightning node that has the channel.                                     |
| `--channel-point` | string | yes      | Channel point identifier in the format "txid:output_index" (e.g., "abc123...def:0"). |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: no. The command does not change files or containers.

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `closeChannel`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await closeChannel({
  polar,
  networkId: 1,
  nodeName: 'alice',
  channelPoint:
    '01326cc467b263b02d2895d65279ab5e4a8b0d3f421c93a42f509590cdb5b462:0',
});
```

## Example

```sh
polarln close-channel --network-id 1 --node-name alice \
  --channel-point 01326cc467b263b02d2895d65279ab5e4a8b0d3f421c93a42f509590cdb5b462:0
```

<!-- END GENERATED -->

## Notes

### Node kinds

`--node-name` must be a Lightning node that has the channel. The name of a node that is not a Lightning node, for example a tapd node, gives `404 PolarNodeNotFound`.

On Docker, the node must be an LND or litd node. A litd node uses its integrated lnd daemon, as in Polar. A c-lightning or eclair node gives `501 PolarToolNotSupported`. With the bridge, Polar also supports these nodes.

For a Taproot Assets channel, use [`close-tap-channel`](close-tap-channel.md) (bridge only).

### Waits

The close is cooperative. The command has no option to force the close.

On Docker, the command waits until lnd sends the transaction that closes the channel. If lnd cannot close the channel, the command fails, and `details.err` has the lnd message. If lnd does not send the transaction in 60 s, the command fails with `504 PolarToolTimedOut`.

Then the command waits 1 s, mines 6 blocks on the first bitcoind node, and waits 1 s again. For LND and litd nodes, Polar does these steps too.

With the bridge, Polar does not wait for lnd, and it does not show an lnd error. Thus the command can give a success result for a channel that lnd did not close. To check the close, use [`list-channels`](list-channels.md).

### Polar app

With the bridge, the command syncs the chart, so the chart removes the channel. A live test with Polar v4.0.0 showed this result. Polar skips a chart sync less than 5 s after the last sync. Each chart sync clears a channel selection in the sidebar.

If the command runs on Docker while the Polar app runs, the app sees a direct change on the node. The mine comes about 1 s after the close, so the chart can keep a dashed line. See [Changes outside polarln](../polar-app.md#changes-outside-polarln).

### See also

- [`list-channels`](list-channels.md): get the channel points of a node, and check the close.
- [`open-channel`](open-channel.md): open a channel.
- [Differences from the Polar app](../docker-backend.md#differences-from-the-polar-app): all waits of the Docker backend.
