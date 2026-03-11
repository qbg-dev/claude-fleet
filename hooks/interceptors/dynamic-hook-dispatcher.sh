#!/usr/bin/env bash
# DEPRECATED — Superseded by engine/hook-engine.sh
# This file is kept as a no-op to prevent errors if referenced by old manifest entries.
# All dynamic hook dispatch is handled by engine/hook-engine.sh which reads from
# ~/.claude/fleet/{project}/{worker}/hooks/hooks.json (new layout)
# or ~/.claude/ops/hooks/dynamic/{worker}.json (legacy fallback).
echo '{}'
exit 0
