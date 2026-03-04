#!/usr/bin/env bash
# fork-worker.sh — Fork Claude into a new pane (child inherits parent conversation).
#
# Registers the new pane in registry.json so the statusline shows the 🔗 worker link.
# When called via MCP spawn_child, registration is already done — this is a no-op.
# When called manually with --name, this script does the registration itself.
#
# Usage: fork-worker.sh <parent_pane_id> <parent_session_id> [--name WORKER_NAME] [--parent PARENT_NAME] [extra-claude-flags...]
#
# Example (paste in new pane after C-x y):
#   bash ~/.claude-ops/scripts/fork-worker.sh %612 abc123def456 --name my-worker --parent chief-of-staff --dangerously-skip-permissions

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BORING_DIR="${BORING_DIR:-$HOME/.boring}"

PARENT_PANE="${1:-}"
PARENT_SESSION="${2:-}"
shift 2 2>/dev/null || true

if [ -z "$PARENT_PANE" ] || [ -z "$PARENT_SESSION" ]; then
  echo "Usage: fork-worker.sh <parent_pane_id> <parent_session_id> [--name WORKER_NAME] [--parent PARENT_NAME] [claude-flags...]" >&2
  exit 1
fi

# Parse optional --name / --parent flags (consume them before passing remaining to claude)
CHILD_NAME=""
CHILD_PARENT=""
CLAUDE_FLAGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)   CHILD_NAME="$2"; shift 2 ;;
    --parent) CHILD_PARENT="$2"; shift 2 ;;
    *)        CLAUDE_FLAGS+=("$1"); shift ;;
  esac
done

echo "Forking session $PARENT_SESSION from parent pane $PARENT_PANE"

# ── Self-register in registry.json (always, even without --name) ──
# This makes the statusline show: 🔗 CHILD_NAME ← CHILD_PARENT
if [ -n "${TMUX_PANE:-}" ]; then
  # Find the registry.json for the current working directory
  _cwd="$(pwd)"
  _main_project="$_cwd"
  if [ -f "$_cwd/.git" ]; then
    _main_project=$(sed 's|gitdir: ||; s|/\.git/worktrees/.*||' "$_cwd/.git" 2>/dev/null || echo "$_cwd")
  fi
  _REGISTRY="$_main_project/.claude/workers/registry.json"

  # Auto-derive name from git branch if --name not given
  if [ -z "$CHILD_NAME" ]; then
    _branch=$(git -C "$_cwd" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
    _base_name="${_branch#worker/}"
    [ -z "$_base_name" ] || [ "$_base_name" = "HEAD" ] && _base_name="fork-${TMUX_PANE#%}"
    # If the base name is already in registry (i.e. we're a fork of that worker), append -fork
    if [ -f "$_REGISTRY" ] && jq -e --arg n "$_base_name" '.[$n] | .pane_id != null' "$_REGISTRY" 2>/dev/null >/dev/null; then
      CHILD_NAME="${_base_name}-fork"
    else
      CHILD_NAME="$_base_name"
    fi
  fi

  # Auto-derive parent name from parent pane if --parent not given
  if [ -z "$CHILD_PARENT" ] && [ -n "$PARENT_PANE" ] && [ -f "$_REGISTRY" ]; then
    CHILD_PARENT=$(jq -r --arg p "$PARENT_PANE" \
      'to_entries[] | select(.value.pane_id == $p) | .key' \
      "$_REGISTRY" 2>/dev/null | head -1 || echo "")
  fi

  if [ -f "$_REGISTRY" ]; then
    # Resolve pane_target from tmux
    _pane_target=$(tmux list-panes -a -F '#{pane_id} #{session_name}:#{window_index}.#{pane_index}' 2>/dev/null \
      | awk -v id="$TMUX_PANE" '$1 == id {print $2; exit}')
    _tmux_session=$(tmux list-panes -a -F '#{pane_id} #{session_name}' 2>/dev/null \
      | awk -v id="$TMUX_PANE" '$1 == id {print $2; exit}')

    # Check if already registered (MCP spawn_child may have done it)
    _existing=$(jq -r --arg name "$CHILD_NAME" '.[$name].pane_id // empty' "$_REGISTRY" 2>/dev/null)
    if [ "$_existing" != "$TMUX_PANE" ]; then
      # Write pane_id + pane_target + parent into registry entry
      _tmp="${_REGISTRY}.fork.$$"
      jq --arg name "$CHILD_NAME" \
         --arg pane_id "$TMUX_PANE" \
         --arg pane_target "${_pane_target:-}" \
         --arg tmux_session "${_tmux_session:-}" \
         --arg parent "${CHILD_PARENT:-}" \
         --arg parent_pane "$PARENT_PANE" \
         'if .[$name] then
            .[$name].pane_id = $pane_id |
            .[$name].pane_target = $pane_target |
            .[$name].tmux_session = $tmux_session |
            .[$name].parent_pane = $parent_pane |
            (if $parent != "" then .[$name].parent = $parent else . end)
          else
            .[$name] = {pane_id: $pane_id, pane_target: $pane_target,
                        tmux_session: $tmux_session, status: "active",
                        parent: $parent, parent_pane: $parent_pane,
                        is_fork: true, branch: ("worker/" + $name)}
          end' "$_REGISTRY" > "$_tmp" 2>/dev/null && mv "$_tmp" "$_REGISTRY"
      echo "Registered $CHILD_NAME (pane $TMUX_PANE, parent: ${CHILD_PARENT:-?} / $PARENT_PANE) in registry.json"
    fi
  fi

  # Export WORKER_NAME so Claude's MCP server knows its identity
  export WORKER_NAME="$CHILD_NAME"
fi

# Hand off to Claude — fork-session creates a new session ID branching from parent
exec claude --resume "$PARENT_SESSION" --fork-session "${CLAUDE_FLAGS[@]+"${CLAUDE_FLAGS[@]}"}"
