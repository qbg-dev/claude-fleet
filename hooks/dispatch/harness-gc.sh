#!/usr/bin/env bash
# harness-gc.sh — Module: GC stale tmp files + dead pane-registry cleanup.
# Sourced by stop-harness-dispatch.sh. Requires: harness-jq.sh, HARNESS_STATE_DIR, _file_mtime,
#   GC_THROTTLE_SEC, GC_STALE_FILE_AGE_SEC, PROCESS_DISCOVERY_MAX_CHILDREN.

# --- GC stale tmp files (throttled: at most once per GC_THROTTLE_SEC) ---
run_gc() {
  local _GC_STAMP="$HARNESS_STATE_DIR/.last_tmp_gc"
  local _GC_NOW=$(date +%s)
  local _GC_LAST=0
  [ -f "$_GC_STAMP" ] && _GC_LAST=$(cat "$_GC_STAMP" 2>/dev/null || echo 0)
  [ $((_GC_NOW - _GC_LAST)) -le "$GC_THROTTLE_SEC" ] && return

  echo "$_GC_NOW" > "$_GC_STAMP"

  # Dead pane cleanup — remove pane-registry entries for panes that no longer exist
  local _PANE_REG="${HARNESS_STATE_DIR}/pane-registry.json"
  if [ -f "$_PANE_REG" ]; then
    local _LIVE_PANES
    _LIVE_PANES=$(tmux list-panes -a -F '#{pane_id}' 2>/dev/null | tr '\n' ' ') || true
    if [ -n "$_LIVE_PANES" ]; then
      python3 -c "
import json, sys
reg = json.load(open('$_PANE_REG'))
live = set('$_LIVE_PANES'.split())
cleaned = {k: v for k, v in reg.items() if k.startswith('%') and k in live}
removed = len(reg) - len(cleaned)
if removed > 0:
    json.dump(cleaned, open('$_PANE_REG', 'w'), indent=2)
    print(f'GC: removed {removed} dead pane(s) from pane-registry', file=sys.stderr)
" 2>&1 || true
    fi
  fi

  # Clean stale state files (>GC_STALE_FILE_AGE_SEC old)
  for _dir in "$HARNESS_STATE_DIR"/sessions/*/; do
    [ -d "$_dir" ] || continue
    for _fname in rotate-signal allow-stop; do
      local _f="$_dir/$_fname"
      [ -f "$_f" ] || continue
      local _age=$(( _GC_NOW - $(_file_mtime "$_f" 2>/dev/null || echo "$_GC_NOW") ))
      [ "$_age" -gt "$GC_STALE_FILE_AGE_SEC" ] && rm -f "$_f" && echo "GC: removed stale $_fname from $(basename "$_dir") (${_age}s old)" >&2
    done
  done
  for _dir in "$HARNESS_STATE_DIR"/harness-runtime/*/; do
    [ -d "$_dir" ] || continue
    local _f="$_dir/pending-registration"
    [ -f "$_f" ] || continue
    local _age=$(( _GC_NOW - $(_file_mtime "$_f" 2>/dev/null || echo "$_GC_NOW") ))
    [ "$_age" -gt "$GC_STALE_FILE_AGE_SEC" ] && rm -f "$_f" && echo "GC: removed stale pending-registration from $(basename "$_dir") (${_age}s old)" >&2
  done
}
