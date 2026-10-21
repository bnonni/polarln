<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln set-auto-mine-mode

> Set the auto-mining mode for a Polar network. Auto-mining automatically generates new blocks at regular intervals, which is useful for testing Lightning Network functionality.

## Usage

```sh
polarln set-auto-mine-mode --network-id <number> --mode <number>
```

## Flags

| Flag           | Type   | Required | Description                                                                                                             |
| -------------- | ------ | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| `--network-id` | number | yes      | ID of the network.                                                                                                      |
| `--mode`       | number | yes      | Auto-mining mode: 0=Off, 30=Every 30s, 60=Every 1m, 300=Every 5m, 600=Every 10m. Values: `0`, `30`, `60`, `300`, `600`. |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: yes. In the Polar home, the command first checks that the Polar app does not run. See [Polar app check](../polar-app.md#polar-app-check).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `setAutoMineMode`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await setAutoMineMode({polar, networkId: 1, mode: 30});
```

## Example

```sh
polarln set-auto-mine-mode --network-id 1 --mode 30
```

<!-- END GENERATED -->

## Notes

The command only sets the mode. It does not mine blocks. To mine blocks now, use [`mine-blocks`](mine-blocks.md).

### Bridge

With the bridge, the Polar app sets the mode only in its memory. The app does not start its mine timer, and it does not write the networks file. The next save of the app writes the mode to the file. These facts come from the Polar v4.0.0 source.

### Docker

On Docker, the command writes the mode to the networks file. It does not change containers. polarln has no mine timer.

In the Polar home, the Polar app reads the mode when the app starts. For a mode that is not 0, the app starts its mine timer. The timer mines 1 block on the first bitcoind node at each interval.

As in Polar, [`stop-network`](stop-network.md) sets the mode to 0 (Off).

### See also

- [`mine-blocks`](mine-blocks.md): mine blocks now.
- [`stop-network`](stop-network.md): stop a network, and set its mode to 0.
- [Networks file](../docker-backend.md#networks-file): the file that keeps the mode on Docker.
