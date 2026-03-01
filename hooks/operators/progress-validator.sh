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

# Only run on file-editing tools
case "$TOOL" in
  Write|Edit|NotebookEdit) ;;
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
for check in "$CHECKS_DIR"/*.sh; do
  [ -f "$check" ] || continue
  OUT=$(bash "$check" 2>/dev/null || true)
  [ -n "$OUT" ] && WARNINGS="${WARNINGS}${OUT}\n"
done

[ -n "$WARNINGS" ] && printf "%b" "$WARNINGS"
exit 0
