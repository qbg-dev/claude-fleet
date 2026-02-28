#!/usr/bin/env bash
# harness-discovery.sh — Module: cross-harness awareness + agent discovery.
# Sourced by stop-harness-dispatch.sh. Requires: harness-jq.sh, OWN_PANE_ID, AGENT_SNAPSHOT_LINES, PROCESS_DISCOVERY_MAX_CHILDREN.

# --- Collect info about all active harnesses (for cross-harness awareness) ---
other_harnesses_info() {
  local my_harness="$1"
  local info=""
  while IFS= read -r pfile; do
    [ -f "$pfile" ] || continue
    local pstatus=$(jq -r '.status // "inactive"' "$pfile" 2>/dev/null || echo "inactive")
    [ "$pstatus" != "active" ] && continue
    local pname=$(jq -r '.harness // ""' "$pfile" 2>/dev/null)
    [ -z "$pname" ] && pname=$(basename "$pfile" | sed 's/-progress\.json//')
    [ "$pname" = "$my_harness" ] && continue
    local pcurrent=$(harness_current_task "$pfile" 2>/dev/null || echo "unknown")
    info="${info}\n  - ${pname}: working on ${pcurrent}"
  done < <(harness_all_progress_files "$PROJECT_ROOT")
  echo "$info"
}

# --- Update tmux pane border + metadata with harness status ---
update_pane_status() {
  local hname="$1" current="$2" done_count="$3" total="$4"
  local pane_id=$(hook_find_own_pane 2>/dev/null || echo "")
  [ -z "$pane_id" ] && return
  local status_text="${hname}: ${current} (${done_count}/${total})"
  local pane_target
  pane_target=$(tmux list-panes -a -F '#{pane_id} #{session_name}:#{window_index}.#{pane_index}' 2>/dev/null | awk -v id="$pane_id" '$1 == id {print $2; exit}')
  pane_registry_update "$pane_id" "$hname" "$current" "$done_count" "$total" "$status_text" "$pane_target"
  tmux select-pane -t "$pane_id" -T "$status_text" 2>/dev/null || true
}

# --- Discover other Claude Code sessions across tmux panes ---
discover_agent_panes() {
  local my_session="$1"
  local my_pane_id="${OWN_PANE_ID:-}"
  local agents="" count=0

  while IFS=$'\t' read -r ptarget ppid pane_id; do
    [ -n "$my_pane_id" ] && [ "$pane_id" = "$my_pane_id" ] && continue

    local is_claude=false
    for cpid in $(pgrep -P "$ppid" 2>/dev/null | head -$PROCESS_DISCOVERY_MAX_CHILDREN); do
      ps -o command= -p "$cpid" 2>/dev/null | grep -q "^claude " && is_claude=true && break
    done
    $is_claude || continue

    local snap=$(tmux capture-pane -t "$pane_id" -p 2>/dev/null | grep -v '^[[:space:]]*$' | tail -$AGENT_SNAPSHOT_LINES)
    local model=$(echo "$snap" | grep -oE '⚙️ [A-Za-z0-9. ]+' | tail -1 | sed 's/⚙️ //')
    local state="idle"
    echo "$snap" | grep -qE '(Thinking|Herding|Discombobulating|Processing|Reasoning|thought for)' && state="busy"
    local task="" session_name=""
    local _pane_data=$(pane_registry_read "$pane_id")
    if [ -n "$_pane_data" ] && [ "$_pane_data" != "{}" ]; then
      task=$(echo "$_pane_data" | jq -r '.display // ""' 2>/dev/null || echo "")
      local _sname=$(echo "$_pane_data" | jq -r '.session_name // ""' 2>/dev/null || echo "")
      local _ssum=$(echo "$_pane_data" | jq -r '.session_summary // ""' 2>/dev/null || echo "")
      if [ -n "$_sname" ]; then
        session_name="[${_sname}]"
        [ -n "$_ssum" ] && session_name="${session_name} ${_ssum}"
      fi
    fi

    local detail="${task:-no status}"
    [ -n "$session_name" ] && detail="${detail} ${session_name}"
    agents="${agents}\n  - ${ptarget} [${model:-?}] (${state}) ${detail}"
    count=$((count + 1))
  done < <(tmux list-panes -a -F $'#{session_name}:#{window_index}.#{pane_index}\t#{pane_pid}\t#{pane_id}' 2>/dev/null)

  [ "$count" -eq 0 ] && return

  local my_pane_id=$(hook_find_own_pane 2>/dev/null || echo "")
  local my_pane=$(hook_pane_target "$my_pane_id" 2>/dev/null || echo "?")
  local my_name=""
  if [ -n "$my_pane_id" ]; then
    local _my_pane_data=$(pane_registry_read "$my_pane_id")
    my_name=$(echo "$_my_pane_data" | jq -r '.harness // empty' 2>/dev/null || true)
    [ -z "$my_name" ] && my_name=$(echo "$_my_pane_data" | jq -r '.session_name // empty' 2>/dev/null || true)
  fi
  local my_sig="${my_pane}${my_name:+ (${my_name})}"
  echo "**Nearby agents (${count}):** (you are ${my_sig})${agents}"
  echo "Send: \`tmux send-keys -t {pane} \"[from ${my_sig}] msg\" && tmux send-keys -t {pane} -H 0d\`"
  echo "Read: \`tmux capture-pane -t {pane} -p | tail -20\`"
  echo "If you receive a message from another agent, ALWAYS reply back (sign with [from ${my_sig}])."
}
