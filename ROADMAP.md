# Roadmap

This file shows the planned work for polarln. The order can change.

## Done

- Phases 0-2 (2026-10-15): the tooling, 48 methods for the Polar bridge tools, and `getNodeCredentials`.
- Phase 3 (2026-10-17): the `polarln` CLI. Each Polar bridge tool is a command. The commands come from the live tool schemas.
- Release 0.1.0 (2026-10-17): polarln is on npm.
- CI (2026-10-19): GitHub Actions runs lint, test, and build on each push to `main` and on each pull request.
- Live UI test (2026-10-19): 16 tests on a Polar network with 3 LND nodes and 1 bitcoind node. The results are in the backlog item "Live network changes from the CLI". The README shows the `mine-blocks` workaround.
- tapd live UI test (2026-10-19): 5 tests with a tapd node (Taproot Assets v0.7.0-alpha).

## Next

No item now. The next item comes from the backlog.

## Backlog

### Live network changes from the CLI

Goal: you run a `polarln` command against a running network. The Polar desktop app shows the change at the same time.

The bridge sends each tool call to the Polar app window. The tool then uses the same store actions as the UI. Polar also subscribes to lnd channel events.

Live test results (2026-10-19: Polar v4.0.0, LND v0.20.0-beta, Bitcoin Core v30.0, Taproot Assets v0.7.0-alpha):

| Change                                      | Through polarln                                                                                      | Directly on the node (`lncli`, `bitcoin-cli`, `tapcli`)        |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Mine blocks                                 | The header and the bitcoind, LND, and tapd sidebars show the new data. The channel sidebar does not. | The UI does not change.                                        |
| Open 1 channel                              | The chart shows the channel.                                                                         | The chart shows the channel: dashed while pending, then solid. |
| Close 1 channel, then mine in less than 5 s | The chart removes the channel.                                                                       | The chart keeps a dashed line.                                 |
| Open 2 channels, then mine in less than 5 s | Not applicable.                                                                                      | The chart keeps 2 dashed lines.                                |
| Send on-chain funds to a node               | Not tested.                                                                                          | The LND sidebar keeps the old balance.                         |
| Pay an invoice                              | The chart syncs. The channel sidebar closes.                                                         | The channel sidebar keeps the old balances.                    |
| Mint a tapd asset                           | The tapd sidebar shows the asset.                                                                    | The tapd sidebar keeps the old list.                           |
| Add a node                                  | The chart shows the node, but the channel lines go away.                                             | Not applicable.                                                |

Findings:

1. A mine through the bridge refreshes the block height, the bitcoind data, the LND node info, on-chain balances, and channel counts, and the tapd balances. The cause is a `mineListener` in `src/store/models/lightning.ts` and in `src/store/models/tap.ts`.
2. Read tools also refresh the UI, with no change to the network. `get_blockchain_info` refreshes the block height (tested). `get_tap_balances` refreshes the tapd sidebar (tested). `list_tap_assets` does not, because the sidebar shows the balances. `get_node_info`, `get_wallet_balance`, and `list_channels` write LND data to the store (from the source).
3. A mine or a read tool does not sync the chart. Channel lines and channel balances change only at a chart sync.
4. These bridge tools sync the chart: `open_channel`, `close_channel`, `close_tap_channel`, `pay_invoice`, `fund_tap_channel`, `pay_asset_invoice`, and `remove_node`. No bridge tool syncs the chart without a change to the network.
5. A disconnect of one channel peer makes Polar sync the chart, with no change to channels or balances (tested 2 times). lnd connects the peer again by itself. The sync also refreshes the LND node data and the tapd balances. A reconnect by lnd can also sync the chart at a time that you do not expect.
6. Two 5-second limits stop a chart sync. The channel event throttle has no trailing call. `syncChart` also skips each call less than 5 s after the last sync, also a call from the bridge (from the source).
7. Each chart sync clears a channel selection in the sidebar. A node selection stays (`src/utils/chart.ts`).
8. `add_node` removes the channel lines from the chart. The next chart sync shows them again.

Gaps:

1. Direct changes on bitcoind, LND, and tapd do not refresh the UI. Workaround: a read command (`get-blockchain-info`, `get-tap-balances`), or `polarln mine-blocks --network-id <id> --blocks 1`.
2. Direct payments do not refresh the channel balances. The Polar code has a TODO for this in `src/store/models/lightning.ts`. Workaround: disconnect one channel peer (finding 5).
3. The two 5-second limits in finding 6 can keep the chart in an old state. Workaround: disconnect one channel peer more than 5 s after the last change.
4. After `add-node`, the chart shows no channel lines. Workaround: disconnect one channel peer.

No upstream Polar PRs for now (decision 2026-10-19). polarln gets its own features instead.

Possible work:

1. Add a `polarln sync` command. Step 1 runs the read tools for each started node, with no change to the network: `get_blockchain_info`, `get_node_info`, `get_wallet_balance`, and `get_tap_balances`. Step 2 disconnects one channel peer of an LND node through the lnd REST API, for the chart sync. Limits: step 2 needs 1 channel between 2 started LND nodes, the 5-second limits apply, and the channels are inactive for about 1 second. Estimate: 1-2 days.
