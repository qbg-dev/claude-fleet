#!/usr/bin/env bash
# progress-validator.sh — PostToolUse operator: runs checks.d/ scripts on edited files.
#
# Invoked by the PostToolUse hook after Write/Edit/NotebookEdit tool calls.
# Sets FILE_PATH and runs every enabled check in hooks/operators/checks.d/.
# Each check script reads FILE_PATH and emits warnings to stdout (empty = ok).
set -uo pipefail

CHECKS_DIR="$(cd "$(dirname "$0")/checks.d" && pwd)"
[ -d "$CHECKS_DIR" ] || exit 0

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || echo "")

# Only skip if tool_name is explicitly set to a non-write tool
case "$TOOL" in
  Write|Edit|NotebookEdit|"") ;;
  *) exit 0 ;;
esac

export FILE_PATH
FILE_PATH=$(echo "$INPUT" | jq -r '
  .tool_input |
  if type == "string" then fromjson else . end |
  .file_path // .notebook_path // ""
' 2>/dev/null || echo "")

[ -z "$FILE_PATH" ] && exit 0

WARNINGS=""

# ── Progress file validation ──────────────────────────────────────────────────
# Check completed tasks that need e2e verification but have no test evidence.
if echo "$FILE_PATH" | grep -qE '(progress|tasks)\.json$|-progress\.json$'; then
  if [ -f "$FILE_PATH" ]; then
    MISSING=$(jq -r '
      .tasks // {} |
      to_entries[] |
      select(
        .value.status == "completed" and
        (.value.metadata.needs_e2e_verification // false) == true and
        ((.value.metadata.test_evidence // "") == "")
      ) | .key
    ' "$FILE_PATH" 2>/dev/null || true)
    if [ -n "$MISSING" ]; then
      echo "PROGRESS VALIDATION: completed task(s) need e2e verification but have no test_evidence: $MISSING"
    fi
  fi
fi

# ── checks.d/ fan-out ─────────────────────────────────────────────────────────
for check in "$CHECKS_DIR"/*.sh; do
  [ -f "$check" ] || continue
  OUT=$(bash "$check" 2>/dev/null || true)
  [ -n "$OUT" ] && WARNINGS="${WARNINGS}${OUT}\n"
done

[ -n "$WARNINGS" ] && printf "%b" "$WARNINGS"
exit 0
