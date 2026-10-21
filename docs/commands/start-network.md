<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln start-network

> Starts a Lightning Network in Polar. This will start all Bitcoin and Lightning nodes in the specified network.

## Usage

```sh
polarln start-network --network-id <number>
```

## Flags

| Flag           | Type   | Required | Description                 |
| -------------- | ------ | -------- | --------------------------- |
| `--network-id` | number | yes      | ID of the network to start. |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: yes. In the Polar home, the command first checks that the Polar app does not run. See [Polar app check](../polar-app.md#polar-app-check).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `startNetwork`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await startNetwork({polar, networkId: 1});
```

## Example

```sh
polarln start-network --network-id 1
```

<!-- END GENERATED -->

## Notes

### Docker backend

- As in Polar, the command uses the compose file of the network. It starts each service of the file with `docker compose up -d`. Thus it starts all node kinds, and also a service that a user added, for example `electrs`.
- The command writes a new compose file only if the file is not there or a port moves.
- Before the start, the command checks the host ports of the nodes. A port in use moves to a free port only if the network has only bitcoind and LND nodes and no other services.
- Else a port in use gives `409 PolarPortInUse` or `409 ComposeFileHasOtherServices`, and nothing changes. The ports of the containers of the network that run do not move.
- As in Polar, the command returns after the nodes are online. It mines 1 block and connects the LND and litd nodes to each other.
- The wait for a bitcoind, LND, or litd node stops after 2 minutes. A node that is not online then gets the `Error` status and an `errorMsg`.
- If the wallet of an LND or litd node stays locked for 5 seconds, the node gets the `Error` status. The message is `The LND wallet is locked`.
- The command succeeds also if a node gets the `Error` status. Check the node statuses in the result.
- The command accepts each network status. Thus it also repairs a `Starting` or `Stopping` status that the Polar app left in the file.
- Before Docker runs, the command checks that it can write the networks file. If this check refuses, the command saves no status and runs no Docker command. A failure after the checks saves the `Error` status.
- In a data folder that is not the Polar home, the container names have only the network id. If a different folder runs a network with the same id, the start gives `409 ContainerNameInUse`. The containers of the other folder do not change.

### Polar app check

- In the Polar home, the check runs before the command, and again before each write of the networks file. The Polar app can start during a long start.
- At a `before-save` refusal, a new compose file, the volume folders, and the containers can be in effect. The startup steps can also be in effect: the wallets, 1 block, and the peer connections.
- If a port moves, the first write comes before these steps.
- After such a refusal, the containers can run, but the file keeps the old statuses. Stop the network in the Polar app. Or quit the app, and stop the network with polarln.

### Polar app and polarln

- After polarln starts a network in the Polar home, the Polar app also shows the network as `Started`. But the app does not get the channel events of this network, so the chart can show old channels.
- To get the channel events, stop the network and start it in the app.
- When the Polar app quits, it stops each started network. This includes a network that polarln started, because the compose project is the same.

### Differences from the Polar app

- As in Polar, `docker compose` runs in the network folder with no `-f` option. Thus it also reads an override file, for example `docker-compose.override.yml`.
- The `-p` option gives the compose project name. Thus `COMPOSE_PROJECT_NAME` cannot change the project, and `COMPOSE_FILE` cannot change the compose file.
- A litd node gets only the LND check of its lnd daemon. Polar also waits for the lit sub-servers, so polarln can show `Started` before Polar does.
- A tapd, c-lightning, or eclair node gets `Started` if its container runs after the Lightning nodes are online. Polar uses an RPC check for these nodes.

### See also

- [`stop-network`](stop-network.md)
- [`start-node`](start-node.md)
- [`get-node-credentials`](get-node-credentials.md)
- [Startup checks](../docker-backend.md#startup-checks)
- [Polar app and polarln](../polar-app.md#polar-app-and-polarln)
