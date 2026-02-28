#!/usr/bin/env bash
# migrate-v3.sh — Migrate harness progress.json → v3 decomposed layout
# Creates: agents/module-manager/config.json, agents/module-manager/state.json, tasks.json
# Idempotent: skips harnesses already migrated, or those without progress.json
# Also migrates any agents/sidecar/ dirs to agents/module-manager/.
set -euo pipefail

PROJECT_ROOT="${1:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
HARNESS_ROOT="$PROJECT_ROOT/.claude/harness"

migrated=0
skipped=0
errors=0

for harness_dir in "$HARNESS_ROOT"/*/; do
  [ -d "$harness_dir" ] || continue
  name=$(basename "$harness_dir")
  progress="$harness_dir/progress.json"
  mm_dir="$harness_dir/agents/module-manager"
  sc_dir="$harness_dir/agents/sidecar"
  tasks_file="$harness_dir/tasks.json"

  # Phase 1: Rename agents/sidecar/ → agents/module-manager/ if module-manager doesn't exist yet
  if [ -d "$sc_dir" ] && [ ! -d "$mm_dir" ]; then
    mv "$sc_dir" "$mm_dir"
    echo "Renamed: $name/agents/sidecar → agents/module-manager"
  fi

  # Phase 2: Migrate from progress.json if not yet decomposed
  if [ ! -f "$progress" ]; then
    # No progress.json — check if already fully v3
    if [ -f "$mm_dir/config.json" ] && [ -f "$mm_dir/state.json" ] && [ -f "$tasks_file" ]; then
      ((skipped++)) || true
    fi
    continue
  fi

  # Check if already migrated
  if [ -f "$mm_dir/config.json" ] && [ -f "$mm_dir/state.json" ] && [ -f "$tasks_file" ]; then
    ((skipped++)) || true
    continue
  fi

  # Validate progress.json is readable JSON
  if ! jq empty "$progress" 2>/dev/null; then
    echo "SKIP $name: invalid JSON in progress.json" >&2
    ((errors++)) || true
    continue
  fi

  echo "Migrating: $name"
  mkdir -p "$mm_dir/memory"

  # ── config.json ──────────────────────────────────────────────
  if [ ! -f "$mm_dir/config.json" ]; then
    jq '{
      name: (.harness // .name // "unknown"),
      mission: (.mission // ""),
      model: (.model // "sonnet"),
      lifecycle: (.lifecycle // "bounded"),
      rotation: (.rotation // {max_rounds: 20, claude_command: "cdo", mode: "new_session"}),
      sleep_duration: (.sleep_duration // 900),
      scope_tags: (.scope_tags // [])
    }' "$progress" > "$mm_dir/config.json"
  fi

  # ── state.json ───────────────────────────────────────────────
  if [ ! -f "$mm_dir/state.json" ]; then
    jq '{
      status: (.status // "active"),
      cycles_completed: (.cycles_completed // 0),
      last_cycle_at: (.last_cycle_at // null),
      session_count: (.session_count // 0)
    }' "$progress" > "$mm_dir/state.json"
  fi

  # ── MEMORY.md ────────────────────────────────────────────────
  if [ ! -f "$mm_dir/MEMORY.md" ]; then
    # Migrate learnings array from progress.json if present
    learnings=$(jq -r '(.learnings // [])[] | "- " + .' "$progress" 2>/dev/null || echo "")
    if [ -n "$learnings" ]; then
      printf '# Memory\n\n%s\n' "$learnings" > "$mm_dir/MEMORY.md"
    else
      printf '# Memory\n\n' > "$mm_dir/MEMORY.md"
    fi
  fi

  # ── inbox.jsonl / outbox.jsonl ───────────────────────────────
  [ ! -f "$mm_dir/inbox.jsonl" ] && touch "$mm_dir/inbox.jsonl"
  [ ! -f "$mm_dir/outbox.jsonl" ] && touch "$mm_dir/outbox.jsonl"

  # ── permissions.json (if missing) ───────────────────────────
  if [ ! -f "$mm_dir/permissions.json" ]; then
    cat > "$mm_dir/permissions.json" <<'PERMEOF'
{
  "model": "sonnet",
  "permission_mode": "bypassPermissions",
  "disallowedTools": [
    "Bash(./scripts/deploy-prod*)",
    "Bash(./scripts/deploy.sh*)",
    "Bash(git push*)",
    "Bash(git reset --hard*)",
    "Bash(git clean*)",
    "Bash(rm -rf*)",
    "Bash(sudo *)",
    "Bash(sshpass*)"
  ]
}
PERMEOF
  fi

  # ── tasks.json ───────────────────────────────────────────────
  if [ ! -f "$tasks_file" ]; then
    tasks_val=$(jq '.tasks // {}' "$progress")
    echo "{\"tasks\": $tasks_val}" > "$tasks_file"
  fi

  ((migrated++)) || true
done

echo "Migration complete: $migrated migrated, $skipped already done, $errors errors"
echo ""
echo "Tip: Run again to verify idempotency — all should show 'already done'."
