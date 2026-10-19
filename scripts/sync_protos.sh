#!/bin/sh
# Copy the lnd protos that polarln uses for a release tag into protos/.
# The files keep the upstream lnrpc layout.
#
# Usage: sh scripts/sync_protos.sh v0.20.0-beta
set -eu

tag="${1:?Usage: sh scripts/sync_protos.sh <lnd tag>}"
root="$(cd "$(dirname "$0")/.." && pwd)"

rm -rf "$root/protos/lnrpc"

for file in lightning.proto routerrpc/router.proto stateservice.proto; do
  mkdir -p "$root/protos/lnrpc/$(dirname "$file")"
  curl -fsSL "https://raw.githubusercontent.com/lightningnetwork/lnd/$tag/lnrpc/$file" \
    -o "$root/protos/lnrpc/$file"
done

printf 'lnd %s\n' "$tag" > "$root/protos/VERSIONS"
