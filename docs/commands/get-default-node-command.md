<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln get-default-node-command

> Returns the default docker command for a given node implementation and version. The command includes placeholders like {{name}}, {{backendName}}, etc. that get replaced with actual values when the node starts. If version is not provided, the latest version will be used.

## Usage

```sh
polarln get-default-node-command --implementation <string> \
  [--version <string>]
```

## Flags

| Flag               | Type   | Required | Description                                                                                                                         |
| ------------------ | ------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `--implementation` | string | yes      | The node implementation to get the default command for. Values: `bitcoind`, `btcd`, `LND`, `c-lightning`, `eclair`, `litd`, `tapd`. |
| `--version`        | string | no       | Optional version of the implementation. Uses latest if not specified.                                                               |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: no. The command does not change files or containers.

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `getDefaultNodeCommand`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await getDefaultNodeCommand({polar, implementation: 'LND'});
```

## Example

```sh
polarln get-default-node-command --implementation LND
```

<!-- END GENERATED -->

## Notes

### Docker backend

- The Docker backend has only the `bitcoind` and `LND` commands. A different implementation gives `501 PolarToolNotSupported`.
- The command is the same for each version of an implementation. The Docker backend does not check the `--version` value. It only shows the value in the result.
- The command does not use Docker or a network. Thus it works without Docker.
- The Docker backend replaces these placeholders when it writes the compose file:
  - bitcoind: `{{rpcUser}}` and `{{rpcAuth}}`.
  - LND: `{{name}}`, `{{containerName}}`, `{{backendName}}`, `{{rpcUser}}`, and `{{rpcPass}}`.
- The command text has line breaks. The compose file gets the command on one line.

### See also

- [`update-node-command`](update-node-command.md)
- [`list-node-versions`](list-node-versions.md)
