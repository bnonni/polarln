# Roadmap

This file shows the planned work for polarln. The order can change.

## Done

- Phases 0-2 (2026-10-15): the tooling, 48 methods for the Polar bridge tools, and `getNodeCredentials`.
- Phase 3 (2026-10-17): the `polarln` CLI. Each Polar bridge tool is a command. The commands come from the live tool schemas.

## Next

1. Publish polarln 0.1.0 to npm.
2. Merge the `ci` branch (GitHub Actions: lint, test, build).

## Later

- Phase 4: use polarln in the live tests of litterm and tapass. This phase starts after litterm 0.3.0.

## Backlog

### Live network changes from the CLI

Goal: you run a `polarln` command against a running network. The Polar desktop app shows the change at the same time.

What works now (from the Polar v4.0.0 source, not tested live):

- The bridge sends each tool call to the Polar app window. The tool then uses the same store actions as the UI. Thus a change through polarln (for example `openChannel`, `startNode`, `addNode`) shows in the UI immediately.
- Polar subscribes to lnd channel events. Thus a channel that you open or close directly on lnd (for example with litterm or `lncli`) also shows in the UI.

Gaps:

1. Balance and payment changes outside the bridge do not cause a UI refresh. The Polar code has a TODO for this in `src/store/models/lightning.ts`.
2. Polar has no tapd listener. Asset changes that you make directly with tapass do not cause a UI refresh.
3. Polar syncs the chart one time per 5 seconds at most, with no trailing call. Thus the UI can miss the last change in a burst of channel events.

Possible work:

1. Do a live test. Run CLI commands while the desktop app is open, and record which changes show.
2. For gaps 1-3, find a bridge tool that makes Polar sync, or send a PR to Polar upstream. Estimate: about 1 week, plus the upstream review time.
