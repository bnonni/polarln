<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln rename-network

> Renames a Lightning Network in Polar and optionally updates its description. The name is used for identification and must be unique among networks.

## Usage

```sh
polarln rename-network --network-id <number> --name <string> \
  [--description <string>]
```

## Flags

| Flag            | Type   | Required | Description                               |
| --------------- | ------ | -------- | ----------------------------------------- |
| `--network-id`  | number | yes      | ID of the network to rename.              |
| `--name`        | string | yes      | New name for the network.                 |
| `--description` | string | no       | Optional new description for the network. |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: yes. In the Polar home, the command first checks that the Polar app does not run. See [Polar app check](../polar-app.md#polar-app-check).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `renameNetwork`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await renameNetwork({
  polar,
  networkId: 1,
  name: 'demo',
  description: 'A demo network',
});
```

## Example

```sh
polarln rename-network --network-id 1 --name demo \
  --description 'A demo network'
```

<!-- END GENERATED -->

## Notes

### Docker backend

- The command changes only the networks file. It does not use Docker, and the containers do not change. Thus it works with all node kinds, also while the network runs.
- Without `--description`, the description stays.
- The Docker backend does not check that the name is unique.

### Polar app check

- In the Polar home, the check runs before the command, and again before the write of the networks file.
- At a refusal, the command made no change.

### See also

- [`list-networks`](list-networks.md)
- [`create-network`](create-network.md)
