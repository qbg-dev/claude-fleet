#!/usr/bin/env bash
# Thin wrapper — delegates to TypeScript implementation in fleet CLI.
# Original bash script preserved at scripts/deep-review.sh.bak
exec fleet deep-review "$@"
