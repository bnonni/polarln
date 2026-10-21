<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln close-tap-channel

> Close a Taproot Asset-enabled Lightning Network channel in a Polar network. This cooperatively closes the specified asset-enabled channel and returns the locked Taproot Assets to the on-chain wallet. Works with litd nodes only.

## Usage

```sh
polarln close-tap-channel --network-id <number> --node-name <string> \
  --channel-point <string>
```

## Flags

| Flag              | Type   | Required | Description                                                                          |
| ----------------- | ------ | -------- | ------------------------------------------------------------------------------------ |
| `--network-id`    | number | yes      | ID of the network.                                                                   |
| `--node-name`     | string | yes      | Name of the litd node that has the channel.                                          |
| `--channel-point` | string | yes      | Channel point identifier in the format "txid:output_index" (e.g., "abc123...def:0"). |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: no (`501 PolarToolNotSupported`).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `closeTapChannel`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await closeTapChannel({
  polar,
  networkId: 1,
  nodeName: 'alice',
  channelPoint:
    '01326cc467b263b02d2895d65279ab5e4a8b0d3f421c93a42f509590cdb5b462:0',
});
```

## Example

```sh
polarln close-tap-channel --network-id 1 --node-name alice \
  --channel-point 01326cc467b263b02d2895d65279ab5e4a8b0d3f421c93a42f509590cdb5b462:0
```

<!-- END GENERATED -->

## Notes

- Docker: the Docker backend does not support this command. It gives `501 PolarToolNotSupported` before the [Polar app check](../polar-app.md#polar-app-check) and before any change. The Docker backend can start and stop a network with tapd and litd nodes, but it has no tapd or litd tools. Under auto, the CLI selects Docker if the Polar app does not run. Thus the Polar app must run for this command. See [Backends](../cli.md#backends).
- Node kind: Polar v4.0.0 looks for `--node-name` in the Lightning nodes of the network. It does not check that the node is a litd node.
- Steps: Polar closes the channel with the same steps as [`close-channel`](close-channel.md) on the bridge. The steps are the close request to the node, a mine of 6 blocks, and a chart sync. The command returns after these steps.
- Chart: Polar does not sync the chart if the last sync was less than 5 s before. See [Changes outside polarln](../polar-app.md#changes-outside-polarln).
- Channel point: `--channel-point` has the format `<txid>:<output index>`. The result of [`list-channels`](list-channels.md) has the `channelPoint` of each channel. The `assets` key of a channel shows its Taproot Assets.

### See also

- [`fund-tap-channel`](fund-tap-channel.md)
- [`get-assets-in-channels`](get-assets-in-channels.md)
