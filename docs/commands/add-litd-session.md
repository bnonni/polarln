<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln add-litd-session

> Create a new Lightning Node Connect (LNC) session for a litd node. This generates a pairing phrase that can be used to connect remote applications to the Lightning node. Sessions can be admin (full access), read_only (view only), or custom (specific permissions).

## Usage

```sh
polarln add-litd-session --network-id <number> --node-name <string> \
  --label <string> --type <string> [--expires-at <number>] \
  [--mailbox-server-addr <string>]
```

## Flags

| Flag                    | Type   | Required | Description                                                                                         |
| ----------------------- | ------ | -------- | --------------------------------------------------------------------------------------------------- |
| `--network-id`          | number | yes      | ID of the network.                                                                                  |
| `--node-name`           | string | yes      | Name of the litd node to create session for.                                                        |
| `--label`               | string | yes      | Human-readable label for the session.                                                               |
| `--type`                | string | yes      | Type of session permissions. Values: `admin`, `read_only`.                                          |
| `--expires-at`          | number | no       | Unix timestamp when the session expires (in seconds). Defaults to 90 days from now if not provided. |
| `--mailbox-server-addr` | string | no       | Optional mailbox server address for the session (defaults to mailbox.terminal.lightning.today:443). |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: no (`501 PolarToolNotSupported`).

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `addLitdSession`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await addLitdSession({
  polar,
  networkId: 1,
  nodeName: 'alice',
  label: 'my-app',
  type: 'read_only',
});
```

## Example

```sh
polarln add-litd-session --network-id 1 --node-name alice --label my-app \
  --type read_only
```

<!-- END GENERATED -->

## Notes

- Docker: the Docker backend does not support this command. It gives `501 PolarToolNotSupported` before the [Polar app check](../polar-app.md#polar-app-check) and before any change. The Docker backend can start and stop a network with tapd and litd nodes, but it has no tapd or litd tools. Under auto, the CLI selects Docker if the Polar app does not run. Thus the Polar app must run for this command. See [Backends](../cli.md#backends).
- Node kind: Polar v4.0.0 accepts only a litd node. An LND, c-lightning, or eclair node gives `503 PolarToolFailed`, with the message `Node "<name>" is not a litd node (implementation: <kind>)`. A tapd or bitcoind node gives `404 PolarNodeNotFound`, because Polar looks only in the Lightning nodes.
- Type: `--type` takes `admin` or `read_only`. The schema text also names `custom`, but Polar v4.0.0 does not accept it. The CLI rejects `--type custom` with the usage error `ExpectedAllowedValueForFlag` (exit code 2), before it runs the tool.
- Expiry: `--expires-at` is a Unix time in seconds. If you do not give it, Polar uses the time 90 days after the call. A time that is not in the future gives `400 PolarRejectedArguments`.
- Mailbox: if you do not give `--mailbox-server-addr`, Polar uses `mailbox.terminal.lightning.today:443`.
- Result: the result has `session`, with the keys of a session in [`list-litd-sessions`](list-litd-sessions.md). `session.pairingPhrase` is the pairing phrase for Lightning Node Connect. The session `type` is `Admin` or `Read Only`, and the times are in milliseconds.
- To revoke the session, give `session.localPublicKey` to [`revoke-litd-session`](revoke-litd-session.md).
