#!/bin/sh
# Run a command with HOME at a new temporary folder. The folder goes away
# after the command, also after Ctrl-C. The exit code of the command stays.
#
# Usage: sh scripts/with_temp_home.sh <command> [<argument>...]
set -u

home="$(mktemp -d)" || exit 1

trap 'rm -rf "$home"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

HOME="$home" "$@"
