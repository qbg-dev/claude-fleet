#!/usr/bin/env bash
# worker-register-child.sh — Register a child pane in registry.json.
#
# Usage: worker-register-child.sh <child_pane_id> <report_to_worker> [--name NAME] [--project <root>]
#
# Writes to registry.json:
#   - Creates entry with report_to field (flat org model)
#
# Example:
#   bash worker-register-child.sh %650 chief-of-staff --name swagger-audit
#   bash worker-register-child.sh %650 chief-of-staff --project /path/to/repo
set -uo pipefail

CHILD_PANE="${1:-}"
REPORT_TO="${2:-}"
shift 2 2>/dev/null || true

[ -z "$CHILD_PANE" ] || [ -z "$REPORT_TO" ] && {
  echo "Usage: worker-register-child.sh <child_pane_id> <report_to_worker> [--name NAME] [--project <root>]" >&2
  exit 1
}

# Parse optional args
PROJECT_ROOT="${PROJECT_ROOT:-}"
CHILD_NAME=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)    CHILD_NAME="$2"; shift 2 ;;
    --project) PROJECT_ROOT="$2"; shift 2 ;;
    *) shift ;;
  esac
done

[ -z "$PROJECT_ROOT" ] && PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || { echo "ERROR: PROJECT_ROOT not set and not in a git repo" >&2; exit 1; })"
REGISTRY="$PROJECT_ROOT/.claude/workers/registry.json"

[ ! -f "$REGISTRY" ] && { echo "ERROR: registry not found: $REGISTRY" >&2; exit 1; }

# Verify report_to exists in registry
REPORT_EXISTS=$(jq -r --arg n "$REPORT_TO" 'has($n)' "$REGISTRY" 2>/dev/null)
[ "$REPORT_EXISTS" != "true" ] && { echo "WARNING: report_to '$REPORT_TO' not in registry — proceeding anyway" >&2; }

# Compute pane_target for child
PANE_TARGET=$(tmux list-panes -a -F '#{pane_id} #{session_name}:#{window_index}.#{pane_index}' 2>/dev/null \
  | awk -v p="$CHILD_PANE" '$1==p{print $2}')

# Require meaningful name
[ -z "$CHILD_NAME" ] && { echo "ERROR: --name is required (use a meaningful kebab-case purpose name)" >&2; exit 1; }

# Lock + write
_LOCK_DIR="${HARNESS_LOCK_DIR:-${HOME}/.claude-ops/state/locks}/worker-registry"
mkdir -p "$(dirname "$_LOCK_DIR")" 2>/dev/null || true
_WAIT=0
while ! mkdir "$_LOCK_DIR" 2>/dev/null; do
  sleep 0.5; _WAIT=$((_WAIT + 1))
  [ "$_WAIT" -ge 10 ] && break
done

TMP=$(mktemp)
jq --arg child "$CHILD_NAME" --arg report_to "$REPORT_TO" \
   --arg pane "$CHILD_PANE" --arg target "${PANE_TARGET:-}" \
  '
  # Flat model: create entry with report_to
  .[$child] = {
    model: (.[$report_to].model // "opus"),
    permission_mode: (.[$report_to].permission_mode // "bypassPermissions"),
    disallowed_tools: (.[$report_to].disallowed_tools // []),
    status: "active",
    perpetual: false,
    report_to: $report_to,
    pane_id: $pane,
    pane_target: $target,
    tmux_session: (.[$report_to].tmux_session // "w"),
    window: (.[$report_to].window // null)
  }
  ' "$REGISTRY" > "$TMP" 2>/dev/null && mv "$TMP" "$REGISTRY" || rm -f "$TMP"

rmdir "$_LOCK_DIR" 2>/dev/null || true

echo "Registered $CHILD_PANE as '$CHILD_NAME' (report_to: $REPORT_TO)"
