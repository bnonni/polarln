<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln list-networks

> Lists all Lightning Networks in Polar with their configurations and status

## Usage

```sh
polarln list-networks
```

## Flags

This command has no flags.

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: no. The command does not change files or containers.

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `listNetworks`. Its only argument is `polar`. See [Methods](../sdk.md#methods).

```ts
await listNetworks({polar});
```

## Example

```sh
polarln list-networks
```

<!-- END GENERATED -->

## Notes

### Docker backend

- The command reads only the networks file, `networks/networks.json` in the data folder. It does not use Docker, so it works without Docker.
- The statuses come from the file, not from the containers. The results show the status labels, such as `Started`, as in the bridge results. The file has the Polar status numbers.
- If there is no networks file, the result has no networks.
- The command also reads a networks file of a different Polar version. A command that changes such a file gives `501 PolarToolNotSupported`.
- A file that is not a networks file gives `503 FailedToReadNetworksFile`.

### Polar app and polarln

- The Polar app does not check Docker at its start. Thus, after a crash of the app, the file can show `Started` for a network that does not run.
- To repair the status, run [`start-network`](start-network.md) or [`stop-network`](stop-network.md).

### See also

- [Networks file](../docker-backend.md#networks-file)
- [`create-network`](create-network.md)
- [`start-network`](start-network.md)
