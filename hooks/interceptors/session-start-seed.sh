#!/usr/bin/env bash
# session-start-seed.sh — SessionStart interceptor that injects the full worker
# seed template + config-driven seed fragments as additionalContext.
#
# Replaces the old tmux pasteBuffer() seed injection from launch.ts.
# Worker identity comes from $WORKER_NAME env var (set by launch.ts).
#
# 1. Generates full seed via bun subprocess (reuses seed.ts generateSeedContent)
# 2. Scans templates/seed-fragments/ for config-driven fragments
# 3. Returns combined content as {"additionalContext": ...}
set -uo pipefail
trap 'echo "{}"; exit 0' ERR
exec 2>/dev/null  # suppress stderr

source "$HOME/.claude-fleet/lib/pane-resolve.sh"

INPUT=$(cat)
hook_parse_input "$INPUT"
SESSION_ID="$_HOOK_SESSION_ID"

# Skip subagents
_is_subagent && { echo '{}'; exit 0; }

# ── Resolve worker name ──
# Primary: $WORKER_NAME env var (set by launch.ts)
# Fallback: harness resolution (for recycled sessions where env may differ)
_wname="${WORKER_NAME:-}"
if [ -z "$_wname" ]; then
  resolve_pane_and_harness "$SESSION_ID"
  [[ "$HARNESS" != worker/* ]] && { echo '{}'; exit 0; }
  _wname="${HARNESS#worker/}"
fi

[ -z "$_wname" ] && { echo '{}'; exit 0; }

# ── Generate seed content via bun subprocess ──
_FLEET_ROOT="${CLAUDE_FLEET_DIR:-$HOME/.claude-fleet}"
_seed_tmp=$(mktemp /tmp/seed-inject.XXXXXX)
_seed_ok=false

_bun=$(command -v bun 2>/dev/null || echo "bun")
if "$_bun" -e "
  const { generateSeedContent } = await import('${_FLEET_ROOT}/mcp/worker-fleet/index.ts');
  process.stdout.write(generateSeedContent());
" > "$_seed_tmp" 2>/dev/null; then
  [ -s "$_seed_tmp" ] && _seed_ok=true
fi

if ! $_seed_ok; then
  # Fallback: minimal seed so worker can still orient itself
  echo "You are worker **${_wname}**. Read mission.md, then call mail_inbox(). Start your next cycle." > "$_seed_tmp"
fi

# ── Scan config-driven seed fragments ──
PROJECT_ROOT="${PROJECT_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
_wdir="$PROJECT_ROOT/.claude/workers/$_wname"
if [ ! -d "$_wdir" ]; then
  _main_root=$(git -C "$PROJECT_ROOT" rev-parse --path-format=absolute --git-common-dir 2>/dev/null | sed 's|/\.git$||')
  [ -n "$_main_root" ] && [ "$_main_root" != "$PROJECT_ROOT" ] && _wdir="$_main_root/.claude/workers/$_wname"
fi

_config="$_wdir/config.json"
_FRAGMENTS_DIR="$_FLEET_ROOT/templates/seed-fragments"

if [ -f "$_config" ] && [ -d "$_FRAGMENTS_DIR" ]; then
  for _frag in "$_FRAGMENTS_DIR"/*.md; do
    [ -f "$_frag" ] || continue
    _field=$(basename "$_frag" .md)

    # Check if the config field exists, is non-null, and non-empty
    _val=$(jq -r --arg f "$_field" '.[$f] // empty' "$_config" 2>/dev/null || echo "")
    [ -z "$_val" ] && continue

    # For arrays, skip if empty
    if echo "$_val" | jq -e 'if type == "array" then length == 0 else false end' >/dev/null 2>&1; then
      continue
    fi

    # Append fragment content
    printf '\n\n' >> "$_seed_tmp"
    cat "$_frag" >> "$_seed_tmp"

    # Special handling: cron_schedule — generate specific CronCreate calls
    if [ "$_field" = "cron_schedule" ]; then
      _count=$(echo "$_val" | jq -r 'length' 2>/dev/null || echo "0")
      if [ "$_count" -gt 0 ]; then
        printf '\n**Call these now:**\n```\n' >> "$_seed_tmp"
        for _i in $(seq 0 $((_count - 1))); do
          _cron=$(echo "$_val" | jq -r ".[$_i].cron" 2>/dev/null || echo "")
          _prompt=$(echo "$_val" | jq -r ".[$_i].prompt // empty" 2>/dev/null || echo "")
          # Default prompt: re-read seed context + check mail
          if [ -z "$_prompt" ]; then
            _prompt="Wake up. Re-read your mission (fleet get ${_wname}). Check mail_inbox(). Continue working."
          fi
          printf 'CronCreate(cron: "%s", prompt: "%s")\n' "$_cron" "$_prompt" >> "$_seed_tmp"
        done
        printf '```\n\n' >> "$_seed_tmp"
      fi
    fi
  done
fi

# ── Return as additionalContext (use --rawfile to avoid jq --arg length limits) ──
jq -n --rawfile ctx "$_seed_tmp" '{"additionalContext":$ctx}'
rm -f "$_seed_tmp"
