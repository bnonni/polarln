<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln revoke-litd-session

> Revoke an existing Lightning Node Connect (LNC) session for a litd node. This permanently disables the session and invalidates its pairing phrase. The session will no longer be usable for remote connections.

## Usage

```sh
polarln revoke-litd-session --network-id <number> --node-name <string> \
  --local-public-key <string>
```

## Flags

| Flag                 | Type   | Required | Description                                  |
| -------------------- | ------ | -------- | -------------------------------------------- |
| `--network-id`       | number | yes      | ID of the network.                           |
| `--node-name`        | string | yes      | Name of the litd node to revoke session for. |
| `--local-public-key` | string | yes      | Local public key of the session to revoke.   |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: no (`501 PolarToolNotSupported`).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `revokeLitdSession`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await revokeLitdSession({
  polar,
  networkId: 1,
  nodeName: 'alice',
  localPublicKey:
    '02f6e60e993bf022290f8be15f1c9ac579ac738113bf1be25a998330c818ee4cca',
});
```

## Example

```sh
polarln revoke-litd-session --network-id 1 --node-name alice \
  --local-public-key 02f6e60e993bf022290f8be15f1c9ac579ac738113bf1be25a998330c818ee4cca
```

<!-- END GENERATED -->

## Notes

- Docker: the Docker backend does not support this command. It gives `501 PolarToolNotSupported` before the [Polar app check](../polar-app.md#polar-app-check) and before any change. The Docker backend can start and stop a network with tapd and litd nodes, but it has no tapd or litd tools. Under auto, the CLI selects Docker if the Polar app does not run. Thus the Polar app must run for this command. See [Backends](../cli.md#backends).
- Node kind: Polar v4.0.0 accepts only a litd node. An LND, c-lightning, or eclair node gives `503 PolarToolFailed`, with the message `Node "<name>" is not a litd node (implementation: <kind>)`. A tapd or bitcoind node gives `404 PolarNodeNotFound`, because Polar looks only in the Lightning nodes.
- Key: `--local-public-key` is the hex `localPublicKey` of the session. Get it from [`list-litd-sessions`](list-litd-sessions.md) or from the result of [`add-litd-session`](add-litd-session.md).
- Result: the result has `success`, `message`, `networkId`, and `nodeName`. The message shows the first 12 characters of the key.
