<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->

# polarln mine-blocks

> Mine Bitcoin blocks in a Polar network. This generates new blocks on the Bitcoin blockchain, which is necessary for confirming transactions and advancing the chain.

## Usage

```sh
polarln mine-blocks --network-id <number> [--blocks <number>] \
  [--node-name <string>]
```

## Flags

| Flag           | Type   | Required | Description                                                                         |
| -------------- | ------ | -------- | ----------------------------------------------------------------------------------- |
| `--network-id` | number | yes      | ID of the network.                                                                  |
| `--blocks`     | number | no       | Number of blocks to mine (default: 6).                                              |
| `--node-name`  | string | no       | Name of the Bitcoin node to mine with (optional, uses first node if not specified). |

For the flags of all commands, see [Global flags](../cli.md#global-flags).

## Backends

- Bridge: yes.
- Docker: yes.
- Polar app check on Docker: no. The command does not change files or containers.

To select the backend, see [Backends](../cli.md#backends).

## SDK

The method is `mineBlocks`. Its arguments are `polar` and the flags in camelCase. See [Methods](../sdk.md#methods).

```ts
await mineBlocks({polar, networkId: 1, blocks: 6});
```

## Example

```sh
polarln mine-blocks --network-id 1 --blocks 6
```

<!-- END GENERATED -->

## Notes

### Node kinds

The command uses a bitcoind node. If you do not give `--node-name`, it uses the first bitcoind node of the network. The name of a node that is not a bitcoind node gives `404 PolarNodeNotFound`. On Docker, the network can also have nodes of other kinds, for example tapd or c-lightning nodes.

### Waits

The node mines the blocks to a new address of its wallet. Then the command waits 0.5 s, so that the other nodes get the blocks. Polar does the same.

### Polar app

With the bridge, each mine refreshes the Polar app. The header and the sidebars of the bitcoind, LND, and tapd nodes show the new data. A mine does not sync the chart. Thus the channel lines, the channel balances, and the channel sidebar do not change. A live test with Polar v4.0.0 showed these results.

A mine also shows a change that you made directly on a node, for example with `lncli` or `bitcoin-cli`. The app then shows the new blocks, the on-chain balances, and the tapd assets. To mine only 1 block, run `polarln mine-blocks --network-id 1 --blocks 1`.

If the command runs on Docker while the Polar app runs, the app does not change. For the app, the mine is a direct change on the node. See [Changes outside polarln](../polar-app.md#changes-outside-polarln).

### See also

- [`get-blockchain-info`](get-blockchain-info.md): refresh the block height in the Polar app, with no new block.
- [`set-auto-mine-mode`](set-auto-mine-mode.md): set the mine interval of the Polar app.
- [`send-bitcoin`](send-bitcoin.md): send coins, and mine 6 blocks with `--auto-mine`.
