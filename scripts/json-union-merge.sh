#!/usr/bin/env bash
# json-union-merge.sh — 3-way JSON merge driver for git
#
# Usage: json-union-merge.sh <ancestor> <ours> <theirs>
#
# Performs a union merge of two JSON objects using jq's `*` operator:
#   - Takes all keys from both ours and theirs (union)
#   - On scalar conflicts: theirs wins
#   - Arrays: theirs replaces ours (no element-level merge)
#   - Writes the result back to the <ours> file
#   - Exits 0 on success, 1 on invalid JSON input
#
# This script is used as git's merge.json-union.driver.
# git config merge.json-union.driver ".claude/scripts/json-union-merge.sh %O %A %B"
#
# Written by infra-monitor cycle 2 (2026-03-03) — needed by worker-fleet-mcp.test.ts

set -euo pipefail

ANCESTOR="${1:-}"
OURS="${2:-}"
THEIRS="${3:-}"

if [[ -z "$ANCESTOR" || -z "$OURS" || -z "$THEIRS" ]]; then
  echo "Usage: $0 <ancestor> <ours> <theirs>" >&2
  exit 1
fi

if [[ ! -f "$ANCESTOR" || ! -f "$OURS" || ! -f "$THEIRS" ]]; then
  echo "Error: one or more input files not found" >&2
  exit 1
fi

# Validate JSON inputs before merging
if ! jq empty "$OURS" 2>/dev/null; then
  echo "Error: <ours> is not valid JSON: $OURS" >&2
  exit 1
fi
if ! jq empty "$THEIRS" 2>/dev/null; then
  echo "Error: <theirs> is not valid JSON: $THEIRS" >&2
  exit 1
fi

# Perform union merge: ours * theirs (theirs wins on conflicts)
# jq `*` does deep merge for objects, replacement for arrays and scalars
MERGED=$(jq -s '.[0] * .[1]' "$OURS" "$THEIRS")

# Write result back to ours (git merge driver protocol)
printf '%s\n' "$MERGED" > "$OURS"
