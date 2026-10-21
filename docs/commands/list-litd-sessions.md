<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln list-litd-sessions

> List all Lightning Node Connect (LNC) sessions for a litd node. This provides information about active sessions including labels, states, pairing phrases, and expiration times. Useful for managing remote Lightning node connections.

## Usage

```sh
polarln list-litd-sessions --network-id <number> --node-name <string>
```

## Flags

| Flag           | Type   | Required | Description                                 |
| -------------- | ------ | -------- | ------------------------------------------- |
| `--network-id` | number | yes      | ID of the network.                          |
| `--node-name`  | string | yes      | Name of the litd node to list sessions for. |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: no (`501 PolarToolNotSupported`).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `listLitdSessions`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await listLitdSessions({polar, networkId: 1, nodeName: 'alice'});
```

## Example

```sh
polarln list-litd-sessions --network-id 1 --node-name alice
```

<!-- END GENERATED -->

## Notes

- Docker: the Docker backend does not support this command. It gives `501 PolarToolNotSupported` before the [Polar app check](../polar-app.md#polar-app-check) and before any change. The Docker backend can start and stop a network with tapd and litd nodes, but it has no tapd or litd tools. Under auto, the CLI selects Docker if the Polar app does not run. Thus the Polar app must run for this command. See [Backends](../cli.md#backends).
- Node kind: Polar v4.0.0 accepts only a litd node. An LND, c-lightning, or eclair node gives `503 PolarToolFailed`, with the message `Node "<name>" is not a litd node (implementation: <kind>)`. A tapd or bitcoind node gives `404 PolarNodeNotFound`, because Polar looks only in the Lightning nodes.
- Result: the result has `sessions`. Each session has `id`, `label`, `pairingPhrase`, `mailboxServerAddr`, `state`, `type`, `accountId`, `localPublicKey`, `remotePublicKey`, `createdAt`, and `expiresAt`.
- Values: `state` is `Created`, `In Use`, `Revoked`, `Expired`, or `Reserved`. `type` is `Read Only`, `Admin`, `Custom`, `UI Password`, `Autopilot`, or `Account`.
- Times: `createdAt` and `expiresAt` are Unix times in milliseconds. The `--expires-at` flag of [`add-litd-session`](add-litd-session.md) is in seconds.
- To revoke a session, give its `localPublicKey` to [`revoke-litd-session`](revoke-litd-session.md).
