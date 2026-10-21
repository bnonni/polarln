<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln import-network-from-zip

> Imports a Lightning Network from a .polar.zip file that was previously exported from Polar. The zip file must exist at the specified path. Returns the imported network summary.

## Usage

```sh
polarln import-network-from-zip --path <string>
```

## Flags

| Flag     | Type   | Required | Description                                     |
| -------- | ------ | -------- | ----------------------------------------------- |
| `--path` | string | yes      | Absolute path to the .polar.zip file to import. |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: no (`501 PolarToolNotSupported`).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `importNetworkFromZip`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await importNetworkFromZip({polar, path: '/tmp/test.polar.zip'});
```

## Example

```sh
polarln import-network-from-zip --path /tmp/test.polar.zip
```

<!-- END GENERATED -->

## Notes

- The Docker backend does not have this command. On Docker, the command gives `501 PolarToolNotSupported` and makes no change.
- The command needs the Polar app. Under the auto backend, the CLI uses the bridge if the Polar app answers. Else the command runs on Docker and gives `501`.
- The Polar app reads the zip file. Thus `--path` must be a path on the computer that runs the Polar app.

### See also

- [`export-network-to-zip`](export-network-to-zip.md)
- [`list-networks`](list-networks.md)
- [Backends](../cli.md#backends)
