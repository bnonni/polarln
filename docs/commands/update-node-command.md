<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln update-node-command

> Updates the custom docker command for a node in a network. This allows customization of node startup parameters. The command will be used instead of the default command for the node implementation. Leave command empty to reset to the default.

## Usage

```sh
polarln update-node-command --network-id <number> --node-name <string> \
  --command <string>
```

## Flags

| Flag           | Type   | Required | Description                                                             |
| -------------- | ------ | -------- | ----------------------------------------------------------------------- |
| `--network-id` | number | yes      | ID of the network containing the node.                                  |
| `--node-name`  | string | yes      | Name of the node whose command should be updated.                       |
| `--command`    | string | yes      | The docker command to use for the node. Empty string resets to default. |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: yes. In the Polar home, the command first checks that the Polar app does not run. See [Polar app check](../polar-app.md#polar-app-check).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `updateNodeCommand`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await updateNodeCommand({polar, networkId: 1, nodeName: 'alice', command: ''});
```

## Example

```sh
polarln update-node-command --network-id 1 --node-name alice --command ''
```

<!-- END GENERATED -->

## Notes

### Docker backend

- On Docker, the network must have only bitcoind and LND nodes, and no other compose services. Else the command gives `501 PolarToolNotSupported` or `409 ComposeFileHasOtherServices` before any change.
- The command writes the networks file and a new compose file. It does not change the container. The node uses the new command at its next start, for example with [`restart-node`](restart-node.md).
- To reset the node to the default command, give an empty value: `--command ''`. A `--command` flag with no value is the usage error `InvalidFlags`.
- The command can use the placeholders of the default command, for example `{{name}}`. The Docker backend replaces them when it writes the compose file. See [`get-default-node-command`](get-default-node-command.md).
- The compose file gets the command on one line. Each group of spaces and line breaks becomes 1 space.
- The command needs Docker only for a compose file that polarDocker did not write. For such a file, the compose check runs `docker compose config`.

### Polar app check

- In the Polar home, the check runs before the command, and again before the write of the networks file.
- At a refusal, the command made no change. The networks file write comes before the compose file write.

### See also

- [`get-default-node-command`](get-default-node-command.md)
- [`restart-node`](restart-node.md)
