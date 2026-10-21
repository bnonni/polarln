<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln export-network-to-zip

> Exports a Lightning Network to a .polar.zip file. The network must be in Stopped or Error status. The exported file can be imported back into Polar using the import_network_from_zip tool.

## Usage

```sh
polarln export-network-to-zip --network-id <number> --output-path <string>
```

## Flags

| Flag            | Type   | Required | Description                                            |
| --------------- | ------ | -------- | ------------------------------------------------------ |
| `--network-id`  | number | yes      | ID of the network to export.                           |
| `--output-path` | string | yes      | Absolute path where the .polar.zip file will be saved. |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: no (`501 PolarToolNotSupported`).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `exportNetworkToZip`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await exportNetworkToZip({
  polar,
  networkId: 1,
  outputPath: '/tmp/test.polar.zip',
});
```

## Example

```sh
polarln export-network-to-zip --network-id 1 --output-path /tmp/test.polar.zip
```

<!-- END GENERATED -->

## Notes

- The Docker backend does not have this command. On Docker, the command gives `501 PolarToolNotSupported` and makes no change.
- The command needs the Polar app. Under the auto backend, the CLI uses the bridge if the Polar app answers. Else the command runs on Docker and gives `501`.
- The Polar app writes the zip file. Thus `--output-path` must be a path on the computer that runs the Polar app.

### See also

- [`import-network-from-zip`](import-network-from-zip.md)
- [`stop-network`](stop-network.md)
- [Backends](../cli.md#backends)
