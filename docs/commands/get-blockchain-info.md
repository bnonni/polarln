<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln get-blockchain-info

> Get blockchain information from a Bitcoin node in a Polar network. Returns current block height, chain name, difficulty, and other blockchain state.

## Usage

```sh
polarln get-blockchain-info --network-id <number> [--node-name <string>]
```

## Flags

| Flag           | Type   | Required | Description                                                                     |
| -------------- | ------ | -------- | ------------------------------------------------------------------------------- |
| `--network-id` | number | yes      | ID of the network.                                                              |
| `--node-name`  | string | no       | Name of the Bitcoin node to query (optional, uses first node if not specified). |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: no. The command does not change files or containers.

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `getBlockchainInfo`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await getBlockchainInfo({polar, networkId: 1});
```

## Example

```sh
polarln get-blockchain-info --network-id 1
```

<!-- END GENERATED -->

## Notes

### Node kinds

The command uses a bitcoind node. If you do not give `--node-name`, it uses the first bitcoind node of the network. The name of a node that is not a bitcoind node gives `404 PolarNodeNotFound`. On Docker, the network can also have nodes of other kinds, for example tapd or c-lightning nodes.

### Polar app

With the bridge, the command also refreshes the block height in the Polar app, with no new block. Thus the app shows the blocks that you mined directly on a node, for example with `bitcoin-cli`. The command does not sync the chart. A live test with Polar v4.0.0 showed these results.

### See also

- [`mine-blocks`](mine-blocks.md): mine blocks, and refresh the node data in the Polar app.
- [`get-bitcoin-wallet-info`](get-bitcoin-wallet-info.md): get the wallet balance of a bitcoind node.
- [Changes outside polarln](../polar-app.md#changes-outside-polarln)
