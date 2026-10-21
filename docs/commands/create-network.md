<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln create-network

> Creates a new Lightning Network in Polar with the specified node implementations and versions. Use the list_node_versions tool to see supported versions. Nodes that omit a version will use the latest available.

## Usage

```sh
polarln create-network --name <string> [--description <string>] \
  [--nodes <json>]
```

## Flags

| Flag            | Type       | Required | Description                                                                                                                                                          |
| --------------- | ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--name`        | string     | yes      | Name of the network.                                                                                                                                                 |
| `--description` | string     | no       | Description of the network.                                                                                                                                          |
| `--nodes`       | JSON array | no       | List of nodes to include in the new network. Each entry may specify a version and count (defaults to 1). Item keys: `implementation` (required), `version`, `count`. |

Each item of `--nodes` is a JSON object with these keys:

| Key              | Type    | Required | Description                                                                                                    |
| ---------------- | ------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| `implementation` | string  | yes      | Node implementation to add to the network. Values: `bitcoind`, `LND`, `c-lightning`, `eclair`, `litd`, `tapd`. |
| `version`        | string  | no       | Version of the implementation to use (optional). Latest version is used when omitted.                          |
| `count`          | integer | no       | Number of nodes of this type to create (default: 1). Minimum: `1`.                                             |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: yes. In the Polar home, the command first checks that the Polar app does not run. See [Polar app check](../polar-app.md#polar-app-check).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `createNetwork`. Its arguments are `polar` and the flags in camelCase. The `nodes` argument is an array, not a JSON text. See [Methods](../sdk.md#methods).

```ts
await createNetwork({
  polar,
  name: 'test',
  nodes: [{implementation: 'bitcoind'}, {implementation: 'LND', count: 2}],
});
```

## Example

```sh
polarln create-network --name test \
  --nodes '[{"implementation": "bitcoind"}, {"implementation": "LND", "count": 2}]'
```

<!-- END GENERATED -->

## Notes

### Docker backend

- The Docker backend creates only `bitcoind` and `LND` nodes. A different implementation gives `501 PolarToolNotSupported` before any change.
- With no `--nodes`, the network gets 2 LND nodes (`alice` and `bob`) and 1 bitcoind node (`backend1`). With `--nodes '[]'`, the network has no nodes.
- An item with no `version` gets the latest version of Polar v4.0.0: bitcoind `30.0`, or LND `0.20.0-beta`.
- For each LND version, the network must have a bitcoind node at or below the compatibility value of that version. See [`list-node-versions`](list-node-versions.md).
- The LND nodes get the Polar names `alice`, `bob`, `carol`, and so on. The bitcoind nodes get the names `backend1`, `backend2`, and so on.
- The new network has the `Stopped` status. Its id is the highest id plus 1. If the folder `networks/<id>` is already there, the command uses the next id.
- The command writes the networks file and the compose file `networks/<id>/docker-compose.yml`. It does not use Docker. The compose file is JSON, and JSON is valid YAML.
- The nodes get the Polar v4.0.0 base ports plus the node index. The command does not check the ports. A start moves a port that is in use, see [`start-network`](start-network.md).
- polarDocker does not read the Polar settings (`settings.json` and `nodes.json`). Thus the nodes get the default commands, the base ports, and the node versions of Polar v4.0.0.

### Polar app check

- In the Polar home, the check runs before the command, and again before the write of the networks file.
- At a refusal, the command made no change. The networks file write comes before the compose file write.

### See also

- [`list-node-versions`](list-node-versions.md)
- [`add-node`](add-node.md)
- [`start-network`](start-network.md)
- [Node kinds](../docker-backend.md#node-kinds)
