#!/usr/bin/env bash
# harness-stop.sh — Legacy wrapper, replaced by harness.sh
# Translates: harness-stop <args> → harness stop <args>
exec "$(dirname "$0")/harness.sh" stop "$@"
