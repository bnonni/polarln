# Contribute to polarln

This page tells you how to set up polarln, test a change, and send it. For the usage docs, see the [docs index](README.md).

- Report a bug or an idea in the [GitHub issues](https://github.com/bnonni/polarln/issues).
- The planned work is in [ROADMAP.md](../ROADMAP.md).
- The changes since the last release are in [CHANGELOG.md](../CHANGELOG.md).

For a bug report, give these items:

- The output of `polarln --version` and `node --version`.
- Line 3 of `polarln --help`. This line shows the backend and the cause of the choice.
- The command, and the JSON error line that the command wrote to stderr.

Contents:

- [Development](#development)
- [Tests](#tests)
- [Docker checks](#docker-checks)
- [New Polar version](#new-polar-version)
- [lnd protos](#lnd-protos)
- [Docs](#docs)
- [Commits](#commits)
- [Pull requests](#pull-requests)

## Development

You need these tools:

- Node.js 22.12 or later.
- pnpm 11. `package.json` has no `packageManager` field, so the CI workflow sets pnpm 11.
- [Bun](https://bun.sh/). `pnpm test`, `pnpm write-docs`, and the check scripts run with Bun. CI uses Bun 1.3.11.
- Docker with Docker Compose v2, only for the [Docker checks](#docker-checks).
- The Polar app v4.0.0 or later, only for a [new Polar version](#new-polar-version).

Get the code, then lint, test, and build it:

```sh
git clone https://github.com/bnonni/polarln.git
cd polarln
pnpm install
pnpm lint
pnpm test
pnpm build
```

- `pnpm lint` runs oxlint with type information, then `oxfmt --check`. A lint warning is also a failure.
- oxfmt also checks the Markdown files. To format a file, run `pnpm format <file>`. With no file, `pnpm format` formats all files.
- `pnpm build` compiles `src/` to `dist/`. To run the built CLI, use `node dist/cli.js <command>`.
- To run the CLI from the source, use `bun src/cli.ts <command>`.

The CI workflow (`.github/workflows/ci.yml`) starts for each pull request and for each push to `main`. It runs `pnpm lint`, `pnpm test`, and `pnpm build`. Then it loads `dist/index.js` in Node.js. It also runs `--help` and `list-networks` of the built CLI on the Docker backend, without Docker. CI does not run the Docker checks or `pnpm check-tools`.

### Package scripts

| Script                   | Use                                                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `pnpm build`             | Delete `dist/`, then compile `src/` to `dist/` with `tsc`.                                                     |
| `pnpm lint`              | Run oxlint and `oxfmt --check`.                                                                                |
| `pnpm format`            | Format the files with oxfmt.                                                                                   |
| `pnpm test`              | Type check `src/` and `test/`, then run `bun test` with a temporary `HOME`. See [Tests](#tests).               |
| `pnpm write-docs`        | Write the command reference in `docs/commands/`. See [Docs](#docs).                                            |
| `pnpm check-docker`      | Test the Docker backend on Docker. See [Docker checks](#docker-checks).                                        |
| `pnpm check-cli`         | Build the package, then test the CLI on Docker under Node.js. See [Docker checks](#docker-checks).             |
| `pnpm check-tools`       | Compare the tools of the Polar app with the bundled tool schemas. See [New Polar version](#new-polar-version). |
| `pnpm sync-protos <tag>` | Copy the lnd protos of an lnd tag. See [lnd protos](#lnd-protos).                                              |
| `pnpm clean`             | Delete `dist/` and `coverage/`.                                                                                |
| `pnpm wipe`              | Delete `node_modules/`.                                                                                        |
| `prepublishOnly`         | pnpm runs `pnpm lint`, `pnpm test`, and `pnpm build` before `pnpm publish`.                                    |

The other files in `scripts/`:

- `command_docs.ts` makes the text of the command reference. `write_docs.ts` and the docs test use it.
- `with_temp_home.sh` runs a command with `HOME` at a new temporary folder. It deletes the folder after the command, also after Ctrl-C.
- `headless_spike.ts` is the first test of the Docker backend idea. `bun scripts/headless_spike.ts up` starts bitcoind and 2 LND nodes without the Polar app. Then it opens a channel and pays an invoice. `bun scripts/headless_spike.ts down` removes the containers and the network folder. The data folder is `$POLARLN_DATA_DIR`, else `~/.polarln`.

### Code from Polar

Some of the code comes from [Polar](https://github.com/jamaljsr/polar) (MIT). [NOTICE](../NOTICE) lists these parts. A file with ported code starts with a comment that names the Polar source files, for example:

```ts
// Ported from jamaljsr/polar (MIT): src/utils/network.ts (createNetwork).
```

If you port code from a different part of Polar, add this comment. Also add the part to NOTICE.

## Tests

`pnpm test` has 2 steps:

1. `tsc -p tsconfig.test.json` type checks `src/` and `test/`. It writes no files.
2. `scripts/with_temp_home.sh` runs `bun test` with `HOME` at a new temporary folder.

The temporary `HOME` keeps the tests away from the real Polar home (`~/.local/share/polar` or `~/.polar`). The tests also give an explicit temporary data folder or home folder, so no test uses the real Polar home. The tests use a fake Docker and a fake Polar bridge from `test/fixtures/`. Thus `pnpm test` does not need Docker or the Polar app. If a Polar process runs, one test of the auto backend in `test/polar_cli/cli.test.ts` skips itself.

To write a test:

- For code in `src/<folder>/`, put the test in `test/<folder>/<name>.test.ts`.
- Use `node:test` and `node:assert/strict`, as the other tests do.
- `bun test` finds the test files by name in all folders, also in `scripts/`. It runs each `*.test.ts`, `*_test.ts`, `*.spec.ts`, and `*_spec.ts` file.
- Do not give a test name to a script that needs Docker or the Polar app. CI runs each test file. Name the script `scripts/check_<name>.ts`, and add a `check-<name>` package script.

## Docker checks

The 2 check scripts use real Docker containers, so Docker must run. Each script makes a new temporary data folder. Thus the scripts do not use the Polar home, and the Polar app check does not run. A new data folder gets network 1, so the containers are `polarln-n1-<name>`.

Run `pnpm check-docker` after a change in `src/polar_docker/` or `src/lnd_grpc/`. Run `pnpm check-cli` after a change in `src/polar_cli/` or `src/cli.ts`.

`pnpm check-docker` calls the SDK methods with `polarDocker`:

- It makes a network with 2 bitcoind nodes and 3 LND nodes. It starts and stops the network 2 times.
- It runs the node tools, the bitcoin tools, and the Lightning tools on the network.
- At the end, it deletes the network and the data folder.
- Exit code 1 means that a check failed.

`pnpm check-cli` builds the package. Then it runs each command as a new `node dist/cli.js` process:

- It checks the Docker help, a command that gives `501`, and a usage error.
- It checks the auto backend with a temporary `HOME` and a closed bridge port. If a Polar process runs, it skips these checks.
- On Docker, it creates and starts a network, gets credentials, opens a channel, pays an invoice, closes the channel, and mines a block.
- It runs `list-networks` with Bun, from `dist/` and from `src/`.
- At the end, it stops and deletes the network. Then it shows a table of the exit codes and the times.

A check fails if a process does not exit within 1 s after its last output. The CLI sets only `process.exitCode`, and the process must end by itself. Do not call `process.exit` in the CLI code, because it can cut the JSON output to a pipe. If a change opens a stream, a timer, a socket, or a child process, close it on all paths.

If `polarln-n1-*` containers exist, `pnpm check-cli` stops with exit code 2 before the checks. These containers can also make `pnpm check-docker` fail. `scripts/headless_spike.ts` also uses these names. To show and remove the containers:

```sh
docker ps -a --filter name=^polarln-n1-
docker rm -f $(docker ps -aq --filter name=^polarln-n1-)
```

Before you remove the containers, make sure that you do not need them.

## New Polar version

`src/polar_cli/bundled_tools.ts` has the names, the descriptions, and the input schemas of the Polar v4.0.0 tools. The CLI uses them on the Docker backend, and `pnpm write-docs` uses them for the command reference. With the bridge, the CLI gets the tools from the Polar app. Thus a new Polar tool is a CLI command at once, but it has no SDK method and no docs page.

To update polarln for a new Polar version:

1. Start the new Polar app. The script uses the bridge at `http://localhost:<port>`. The port is `POLAR_MCP_PORT`, else 37373.
2. Run `pnpm check-tools`. The script compares the live tools with `src/polar_cli/bundled_tools.ts`.
3. If the script shows a change, update the methods and their types in `src/polar_methods/`.
4. Run `pnpm check-tools --write <version>`, for example `pnpm check-tools --write 4.1.0`.
5. For each new tool, add example values to `examples` in `scripts/command_docs.ts`. Then run `pnpm write-docs`.
6. In [NOTICE](../NOTICE), update the Polar version of the tool schemas.
7. Run `pnpm lint` and `pnpm test`.

`pnpm check-tools` shows one line for each difference:

| Line                          | Difference                                                          |
| ----------------------------- | ------------------------------------------------------------------- |
| `added: <tool>`               | The Polar app has a tool that the file does not have.               |
| `removed: <tool>`             | The file has a tool that the Polar app does not have.               |
| `changed arguments: <tool>`   | The properties or the required arguments of the tool are different. |
| `changed description: <tool>` | The description of the tool is different.                           |
| `no change: <count> tools`    | The tools are the same.                                             |

The exit code is 0 for no change, 1 for a change, and 2 for a usage error. With `--write`, the script writes the file also if there is no change, and the exit code is 0. The script formats the file with oxfmt. `v4.1.0` and `4.1.0` give the same version.

More rules for a changed tool list:

- A new SDK method has the camelCase name of the tool, for example `export const openChannel = toolMethod<OpenChannelArgs, OpenChannelResult>('open_channel');`. Put it in the file of its group. The group of the command in the [command index](commands/README.md) comes from this file.
- `pnpm write-docs` stops with an error if a tool has no example: `Add an example for <tool> to command_docs.ts`. It also stops if a tool has no SDK method: `No SDK method <method> in src/polar_methods`.
- For a removed tool, delete its page in `docs/commands/`. `pnpm write-docs` shows a warning for the page, and `pnpm test` fails until you delete it.
- A new tool is not a Docker tool. On the Docker backend, it rejects with `501`. See [Add a Docker tool](#add-a-docker-tool).

### Add a Docker tool

1. Write the tool in `src/polar_docker/tools/<tool_name>.ts`.
2. Add the tool name to `dockerToolNames` in `src/polar_docker/docker_tool_names.ts`.
3. Add the tool to `dockerTools` in `src/polar_docker/execute_tool.ts`.
4. If the tool does not change files or containers, add its name to `readToolNames`. Each other tool gets the [Polar app check](polar-app.md#polar-app-check).
5. Run `pnpm write-docs`. The command page then shows the Docker support. Also update the tool lists in [docker-backend.md](docker-backend.md).

## lnd protos

`src/lnd_grpc` uses the lnd protos in `protos/lnrpc/`. `protos/VERSIONS` names the lnd tag of these files, now `lnd v0.20.0-beta`. To copy the protos of a different lnd tag, run `pnpm sync-protos <tag>`, for example `pnpm sync-protos v0.20.0-beta`. The script deletes `protos/lnrpc/`. Then it downloads `lightning.proto`, `routerrpc/router.proto`, and `stateservice.proto` from GitHub with `curl`. At the end, it writes the tag to `protos/VERSIONS`.

## Docs

The docs have 3 parts:

- [README.md](../README.md): the overview, the install, and a quick start.
- The guides in `docs/`, for example [cli.md](cli.md) and [sdk.md](sdk.md). People write these pages by hand.
- The command reference in [docs/commands/](commands/README.md): one page for each CLI command.

Rules for all docs:

- Write the prose in Simplified Technical English (ASD-STE100). Use the active voice and simple tenses.
- Write an instruction in 20 words or fewer, and a description in 25 words or fewer.
- Do not use the em dash (U+2014). Use a comma, a colon, parentheses, or a period.
- The tool descriptions from the Polar schemas are quoted data. Do not change them.
- Use relative links between the docs files.
- Check each fact in the current code before you write it.
- If users can see your change, update the docs in the same pull request. Also add a line to the `## Unreleased` section at the top of [CHANGELOG.md](../CHANGELOG.md). If the section is not there, add it.

### Generated command reference

Run `pnpm write-docs` to write the command reference.

- `pnpm write-docs` writes all of `docs/commands/README.md`. Its first line is `<!-- GENERATED: pnpm write-docs. Do not edit this file. -->`.
- Each command page has a generated region between the 2 marker lines below.
- The script changes only the region of a page. The text after the END line stays.
- For a new command, the script makes a page with the region, then `## Notes` with the text `No notes.`.
- The script deletes no file. For a page with no command, it shows a warning.
- If a page does not have one BEGIN line and then one END line, the script shows an error. The page does not change, and the exit code is 1.

```md
<!-- BEGIN GENERATED: pnpm write-docs. Do not edit. -->
<!-- END GENERATED -->
```

The region gets its text from these sources. To change the region, change a source, then run `pnpm write-docs`.

- The tool schemas: `src/polar_cli/bundled_tools.ts`, and `src/polar_cli/local_tools.ts` for `get-node-credentials`.
- The Docker tool lists in `src/polar_docker/docker_tool_names.ts`.
- The SDK methods in `src/polar_methods/`.
- The example values and the page layout in `scripts/command_docs.ts`.

The output of the script is already in the oxfmt format. If oxfmt changes a generated region, change `scripts/command_docs.ts`, not the page.

`pnpm test` checks the command reference (`test/docs/command_docs.test.ts`). The test fails if a page is not there, if a region or the index is old, or if a page has no command. It also fails if the CLI does not parse an example to the example arguments. If the test fails, run `pnpm write-docs`, and commit the changed pages.

### Add notes to a command page

1. Open `docs/commands/<command>.md`.
2. Below the `<!-- END GENERATED -->` line, replace `No notes.` with your notes.
3. Do not edit the text between the 2 marker lines.
4. Run `pnpm format docs/commands/<command>.md`.
5. Run `pnpm test`.

The notes tell what the generated region cannot tell. Examples are the Docker behavior, the node kinds, the waits, the Polar app check, and the differences from the Polar app. If a fact is true for many commands, write it one time in a guide, and link to it.

## Commits

polarln uses [Conventional Commits](https://www.conventionalcommits.org/). The log has these types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, and `ci`.

- Write the summary line as `<type>: <summary>`, with no scope.
- Start the summary with a verb in lower case. Do not put a period at the end.
- In the body, tell why the change is necessary, then tell what changed. Wrap the lines at 72 characters.
- Write the commit messages in Simplified Technical English, as the docs.
- Put the docs changes in a separate `docs` commit. A `feat` or `fix` commit has the code and its tests.

Examples from the log:

```text
feat: add the auto backend and make it the CLI default
fix: check node kinds and compose services before any change
docs: document the Polar home and the auto backend
```

## Pull requests

1. Make a branch from `main`.
2. Make the change, with tests.
3. Run `pnpm lint`, `pnpm test`, and `pnpm build`.
4. If the change is in the Docker backend or the CLI, run the [Docker checks](#docker-checks).
5. Update the docs and [CHANGELOG.md](../CHANGELOG.md).
6. Open a pull request to `main`.
