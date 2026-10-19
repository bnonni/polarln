# Roadmap

This file shows the planned work for polarln. The order can change.

## Done

- Phases 0-2 (2026-10-15): the tooling, 48 methods for the Polar bridge tools, and `getNodeCredentials`.
- Phase 3 (2026-10-17): the `polarln` CLI. Each Polar bridge tool is a command. The commands come from the live tool schemas.
- Release 0.1.0 (2026-10-17): polarln is on npm.
- CI (2026-10-19): GitHub Actions runs lint, test, and build on each push to `main` and on each pull request.
- Live UI test (2026-10-19): 16 tests on a Polar network with 3 LND nodes and 1 bitcoind node. The results are in the backlog item "Live network changes from the CLI". The README shows the `mine-blocks` workaround.

## Next

No item now. The next item comes from the backlog.

## Backlog

### Live network changes from the CLI

Goal: you run a `polarln` command against a running network. The Polar desktop app shows the change at the same time.

The bridge sends each tool call to the Polar app window. The tool then uses the same store actions as the UI. Polar also subscribes to lnd channel events.

Live test results (2026-10-19: Polar v4.0.0, LND v0.20.0-beta, Bitcoin Core v30.0):

| Change                                      | Through polarln                                                          | Directly on the node (`lncli`, `bitcoin-cli`)                  |
| ------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Mine blocks                                 | The header, the bitcoind sidebar, and the LND sidebar show the new data. | The UI does not change.                                        |
| Open 1 channel                              | The chart shows the channel.                                             | The chart shows the channel: dashed while pending, then solid. |
| Close 1 channel, then mine in less than 5 s | The chart removes the channel.                                           | The chart keeps a dashed line.                                 |
| Open 2 channels, then mine in less than 5 s | Not applicable.                                                          | The chart keeps 2 dashed lines.                                |
| Send on-chain funds to a node               | Not tested.                                                              | The LND sidebar keeps the old balance.                         |
| Pay an invoice                              | The chart syncs. The channel sidebar closes.                             | The channel sidebar keeps the old balances.                    |

Findings:

1. `polarln mine-blocks --network-id <id> --blocks 1` refreshes the block height, the bitcoind data, and the info, on-chain balance, and channel counts of all LND nodes (`mineListener` in `src/store/models/lightning.ts`). Use it after a direct change.
2. A mine does not sync the chart. Channel lines and channel balances change only at a chart sync.
3. These bridge tools sync the chart: `open_channel`, `close_channel`, `close_tap_channel`, `pay_invoice`, `fund_tap_channel`, `pay_asset_invoice`, and `remove_node`. No bridge tool syncs the chart without a change to the network.
4. Two 5-second limits stop a chart sync. The channel event throttle has no trailing call. `syncChart` also skips each call less than 5 s after the last sync, also a call from the bridge (from the source).
5. Each chart sync clears a channel selection in the sidebar. A node selection stays (`src/utils/chart.ts`).
6. A peer disconnect in lnd sends channel events. Thus a disconnect of one channel peer makes Polar sync the chart, with no change to channels or balances (tested: a stale dashed line went away). lnd connects the peer again by itself. A reconnect by lnd can also sync the chart at a time that you do not expect.

Gaps:

1. Direct on-chain changes and direct mines do not refresh the UI. Workaround: `polarln mine-blocks --network-id <id> --blocks 1`.
2. Direct payments do not refresh the channel balances. Workaround: disconnect one channel peer (finding 6). The Polar code has a TODO for this in `src/store/models/lightning.ts`.
3. Polar has no tapd listener. Thus asset changes directly on tapd do not refresh the UI (from the source, not tested live).
4. The two 5-second limits in finding 4 can keep the chart in an old state.

No upstream Polar PRs for now (decision 2026-10-19). polarln gets its own features instead.

Possible work:

1. Do a live test of gap 3 with a tapd node. Estimate: about 30 minutes.
2. Add a `polarln sync` command. It disconnects one channel peer of an LND node through the lnd REST API. lnd connects the peer again, and Polar then runs `syncChart`. `syncChart` refreshes the chart, the channel balances, the info and balances of all LND nodes, and the tapd assets. Limits: the network must have 1 channel between 2 started LND nodes, and the 5-second limits apply. Estimate: 1-2 days.
