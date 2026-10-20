# Roadmap

This file shows the planned work for polarln. The order can change.

## Done

- Phases 0-2 (2026-10-15): the tooling, 48 methods for the Polar bridge tools, and `getNodeCredentials`.
- Phase 3 (2026-10-17): the `polarln` CLI. Each Polar bridge tool is a command. The commands come from the live tool schemas. With `--backend docker` (2026-10-20), the commands come from the bundled tool schemas.
- Release 0.1.0 (2026-10-17): polarln is on npm.
- CI (2026-10-19): GitHub Actions runs lint, test, and build on each push to `main` and on each pull request.
- Live UI test (2026-10-19): 16 tests on a Polar network with 3 LND nodes and 1 bitcoind node. The results are in the backlog item "Live network changes from the CLI". The README shows the `mine-blocks` workaround.
- tapd live UI test (2026-10-19): 5 tests with a tapd node (Taproot Assets v0.7.0-alpha).
- Polar home and auto backend (2026-10-20): the CLI default is `auto`. If the Polar app runs, the CLI uses the bridge. Else, it runs the command on Docker in the Polar home (`~/.local/share/polar` if it exists, else `~/.polar`). polarln never changes the Polar files while the app runs. The changes:
  1. `polarDocker` reads and writes the Polar v4.0.0 networks file in each data folder. It writes only the final statuses, keeps the charts in sync, and holds a lock during each change.
  2. In the Polar home, the containers and the compose projects have the Polar names. A path check and a container check stop a copy of a data folder from a change to the original.
  3. In the Polar home, each tool that can change files or containers first checks that the Polar app does not run. The check uses a bridge probe and a process scan, and it fails closed.
  4. A start and a stop use the compose file of the network, as in Polar. Thus networks with litd and tapd nodes, and with services that a user added, start and stop. The Lightning tools work on litd nodes.
  5. The node-change tools refuse a network with a node kind or a compose service that `polarDocker` cannot write, before any change.
- Docker names for each data folder (2026-10-20): the compose commands of one folder do not change the containers of a different folder. A command that finds a container of a different folder gives `409 ContainerNameInUse`. This was backlog item 1.

## Next

### Headless backend (no Polar app)

Goal: the SDK and the CLI start and control regtest networks without the Polar desktop app. This was the first goal of polarln.

Design (proposed): one SDK with two backends. `polarBridge({url})` sends the tool calls to the Polar app. A new `polarDocker({dataDir})` runs the same `execute(tool, args)` on Docker, so the 48 methods do not change. The data folder was `~/.polarln` at first. Since 2026-10-20, the default is the Polar home. The nodes use the Polar Docker images and the Polar v4.0.0 compose templates.

Spike (2026-10-19, done): `scripts/headless_spike.ts` starts 1 bitcoind node and 2 LND nodes. Then it mines, opens 1 channel, and pays 1 invoice. Run `bun scripts/headless_spike.ts up`, then `bun scripts/headless_spike.ts down`.

Spike results (Bitcoin Core v30.0, LND v0.20.0-beta):

1. A full run takes about 9 s, from no containers to a paid invoice. The run passes under bun 1.3.11 and under Node 24.
2. `@lightningpolar/lnd-api` 0.20.0-beta works under bun and under Node. But it pins `@grpc/grpc-js` 1.10.8, which has 5 audit advisories (3 high). The MVP uses an own transport (see "Next phases").
3. `bitcoin-core` 5.0.0 (the latest version) depends on the deprecated `request` package and on `bunyan`. The spike uses a `fetch` JSON-RPC client for bitcoind, with no package.
4. A JSON compose file is valid YAML, so `docker compose` reads it. The spike does not use `js-yaml`, `docker-compose`, or `dockerode`.
5. LND returns `FAILURE_REASON_INSUFFICIENT_BALANCE` until the `channel_ready` exchange ends, also if the sender shows the channel as active. The spike waits until both nodes show the channel as active. Then it tries the payment again for a maximum of 30 s. Later measurement (MVP step 3): a payment works after the sender graph has the channel, about 1 s after the channel is active. After about 1.6 s, the graphs of the 2 nodes have the channel with the 2 policies. `open_channel` waits for this.
6. LND sends the `SUCCEEDED` payment status before the commitment update ends on the receiver. The receiver balance changes after that.
7. The container names are `polarln-n<id>-<name>`. Each port is the first free port at or above the Polar base port. The spike ran next to 2 started Polar networks with no conflict.
8. Under Node, `@grpc/grpc-js` prints the `DEP0123` warning if the socket host is an IP address. The spike uses `localhost`, as `getNodeCredentials` does.
9. With `--noseedbackup`, lnd shows the `LOCKED` wallet state for a short time after a restart. Then it unlocks the wallet itself. Polar v4.0.0 has no `Locked` status. Polar calls `getInfo` until it works, and after 120 s it sets the `Error` status. `polarDocker` sets the `Error` status with the message "The LND wallet is locked" if the `LOCKED` state stays for 5 s.

Next phases:

1. MVP, 2-3 weeks: `polarDocker` with bitcoind and LND, a network file, and a backend flag for the CLI. The network file was in `~/.polarln` at first. Now it is in the Polar home. In headless mode, the CLI reads a bundled tool schema, not the live schema. The steps:
   1. Done (2026-10-19): `src/lnd_grpc`, the polarln gRPC transport for the lnd Lightning, Router, and State services. It uses the lnd v0.20.0-beta protos in `protos/lnrpc` (`pnpm sync-protos <tag>`) and `@grpc/grpc-js` ^1.14.6. The fields are camelCase, as in `@lightningpolar/lnd-api`, so the Polar mappers can stay the same. `pnpm audit` shows no advisories. The spike uses the transport and passes under bun and under Node.
   2. Done (2026-10-19): `polarDocker({dataDir})` in `src/polar_docker`. The 48 methods send their tool calls to the backend through `polar.execute`. The backend has the Polar network model: the network file, the node names, the ports, and the compose file. It has 6 tools: `list_networks`, `create_network`, `start_network`, `stop_network`, `delete_network`, and `rename_network`. The results and the errors have the same shape as from the bridge. Live test: 3 start and stop cycles with 2 bitcoind nodes and 3 LND nodes. Each start takes 4-6 s. The test passes under bun and under Node.
   3. The other tools for bitcoind and LND nodes. Port the Polar LND and bitcoind tool logic and the Polar `mappers.ts`, so that the results are the same as the bridge results.
      1. Done (2026-10-19): the 10 node tools: `add_node`, `remove_node`, `start_node`, `stop_node`, `restart_node`, `rename_node`, `list_node_versions`, `get_default_node_command`, `update_node_command`, and `set_lightning_backend`. Live test: each tool on a started network with 2 bitcoind nodes and 3 LND nodes. The test takes 47 s.
      2. Done (2026-10-19): the 6 bitcoin tools: `mine_blocks`, `get_blockchain_info`, `get_bitcoin_wallet_info`, `send_bitcoin`, `get_new_bitcoin_address`, and `set_auto_mine_mode`. In Polar, `set_auto_mine_mode` sets only the mode value in memory: the bridge tool does not start the mine timer and does not save the mode. `polarDocker` saves the mode and does not mine.
      3. Done (2026-10-19): the 8 lightning tools: `open_channel`, `close_channel`, `list_channels`, `get_node_info`, `get_wallet_balance`, `deposit_funds`, `create_invoice`, and `pay_invoice`, with the Polar `mappers.ts`. Live test: all 30 tools on a started network with 2 bitcoind nodes and 3 LND nodes, also a 2-hop payment over a private channel. The test takes 64 s. A run under Node from `dist` also passes.
   4. Done (2026-10-20): the CLI backend flag and the bundled tool schema. `--backend docker` or `POLARLN_BACKEND=docker` selects the Docker backend, and `--data-dir` sets its data directory. The docker commands come from `src/polar_cli/bundled_tools.ts` (Polar v4.0.0), so the help works without Docker. The commands that `polarDocker` does not support reject with 501. The close and pay streams of lnd now end when the gRPC client closes, so each command process exits. A missing Docker gives `503 DockerNotAvailable`. Live test: `pnpm check-cli` runs 15 commands with `node dist/cli.js`, and `list-networks` with bun from `dist` and from `src`. Each process exits less than 25 ms after its last output. The test takes about 20 s.
2. tapd and litd, 1-2 weeks. Done (2026-10-20): a start and a stop of networks with tapd and litd nodes, and the Lightning tools on litd nodes. The other items are in the backlog ("Polar home follow-ups"). Live test (2026-10-21) on the real Polar networks 4 (litd) and 5 (tapd): the CLI started both networks, and the tools worked. The Polar app opened network 5 as Started, with its chart. When the app quit, it stopped network 5. After each cycle, `networks.json` was byte-equal to the file before the test.
3. Core Lightning, Eclair, and zip import and export, 1-2 weeks.

## Backlog

### Docker backend follow-ups

1. Networks with the same id in 2 data folders that are not the Polar home. Now the names (`polarln-n<id>-<name>`) come from the network id only, so the second start gives `409 ContainerNameInUse`. A part of the folder path in the names can let both networks run at the same time. See `src/polar_docker/node_names.ts` and `src/polar_docker/compose_file.ts`.
2. A timeout for each `docker compose` command. Now a stuck `docker` command blocks the tool with no limit (`src/polar_docker/run_compose.ts`).
3. Global CLI flags before the command, for example `polarln --backend docker list-networks`. Now this is the usage error `ExpectedCommandBeforeFlags`.

### Polar home follow-ups

1. A startup check of the lit sub-servers for litd nodes, as in the Polar `litdService.waitUntilOnline`. Now a litd node gets Started after the LND check of its lnd daemon.
2. Startup probes, RPC tools, and compose templates for tapd, c-lightning, and eclair nodes, and a compose template for litd nodes. Now these nodes get Started from the container state, and the node-change tools give `501` on their networks.
3. Keep the services that a user added (for example `electrs`) in a new compose file. Now the node-change tools give `409 ComposeFileHasOtherServices` on such a network.
4. simln: the Polar activity simulation.
5. The Polar settings in the Polar home: the base ports of `settings.json`, and the custom images (`nodeImages.managed` and `nodeImages.custom`). Now new nodes get the Polar v4.0.0 defaults.
6. A Docker state overlay in `list_networks`: one `docker ps` can show the real container states. Now `list_networks` shows the statuses of the file.
7. A lock for each network during a long tool. Now only each read-modify-write of `networks.json` has a lock. A long tool writes back its copy of the network. Thus a change that a different process makes to that network during the tool is lost.
8. A test of the macOS process scan (`ps -A -o pid=,comm=`, process name `Polar`) on a Mac.
9. A safe takeover of a stale lock (`src/polar_docker/lock_networks_file.ts`). Now a waiter removes a lock folder that is older than 30 s. If 2 waiters find the same old lock, the second waiter can remove the new lock of the first waiter. Then both waiters change the networks file at the same time. A release also removes the lock folder with no check of the owner. A fix needs an owner token in the lock folder, or a heartbeat that updates the time of the lock.
10. The Polar home under a different `HOME`, for example under `sudo`. `isPolarHome` compares the data folder only with the 2 Polar folders of the current `HOME`. Thus, with `HOME=/root`, `polarln --data-dir /home/u/.polar` uses the `polarln` names, and the Polar app check does not run. A possible rule: a data folder is also the Polar home if a network compose file has `name: polar-network-<id>`. A real path that ends with `/.polar` or `/.local/share/polar` can also count. The compose file rule also gives the Polar names to a copy of the Polar home with edited paths.

Small items from the review:

1. `rename_node`: check the container name of the new node name before the rename. Now a container of a different folder with that name makes the start after the rename give `409 ContainerNameInUse`, and the network stays stopped.
2. `docker compose config --services` shows only the services with no profile or with an active profile. Use `--profile '*'`, and remove `COMPOSE_PROFILES` from the environment of the call.
3. On a macOS volume that ignores the case of names, `--data-dir ~/.POLAR` is the Polar home, but `isPolarHome` gives false. A compare of the device and inode numbers can find this case.
4. Under auto, `polarln --help` gives `409 PolarAppRunsWithoutBridge` if a Polar process runs and its bridge does not answer. The help can show the bundled tools and a note.
5. `planStart` (`src/polar_docker/network_actions.ts`) looks only for `docker-compose.yml`. Compose reads `compose.yaml` first. If a user adds a `compose.yaml`, a port move writes a file that Compose does not read.

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
