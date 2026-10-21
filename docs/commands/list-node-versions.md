<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln list-node-versions

> Lists all supported versions for node implementations included in Polar and the compatibility requirements for each version. The compatibility requirements are a map of version to the minimum version that is compatible with it.

## Usage

```sh
polarln list-node-versions [--implementation <string>]
```

## Flags

| Flag               | Type   | Required | Description                                                                                                                                |
| ------------------ | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `--implementation` | string | no       | Filter to show versions for a specific implementation only (optional). Values: `bitcoind`, `LND`, `c-lightning`, `eclair`, `litd`, `tapd`. |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: no. The command does not change files or containers.

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `listNodeVersions`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await listNodeVersions({polar, implementation: 'LND'});
```

## Example

```sh
polarln list-node-versions --implementation LND
```

<!-- END GENERATED -->

## Notes

### Docker backend

- The Docker backend lists only `bitcoind` and `LND`. A different `--implementation` gives `501 PolarToolNotSupported`. Polar also lists the other implementations.
- The versions come from the Polar v4.0.0 list in polarln. The Docker backend does not read the version list that the Polar app saves in `nodes.json`.
- Only LND has a compatibility list. Each value is the highest bitcoind version that the LND version supports.
- The tool description says "minimum version". But on Docker, `create-network` and `add-node` use the value as the maximum bitcoind version.
- The command does not use Docker or a network. Thus it works without Docker.

### See also

- [`create-network`](create-network.md)
- [`add-node`](add-node.md)
- [`get-default-node-command`](get-default-node-command.md)
