#!/usr/bin/env bash
# setup-hooks.sh — Install hooks from manifest.json into ~/.claude/settings.json
#
# Usage:
#   bash ~/.claude-ops/scripts/setup-hooks.sh              # Install all hooks
#   bash ~/.claude-ops/scripts/setup-hooks.sh --dry-run     # Show what would change
#   bash ~/.claude-ops/scripts/setup-hooks.sh --core-only   # Only required hooks
#   bash ~/.claude-ops/scripts/setup-hooks.sh --diff        # Show diff vs current
#
# Reads manifest.json, builds the hooks object, merges into settings.json.
# Project-specific hooks (category=project) are skipped — they belong in
# per-project .claude/settings.local.json.
set -euo pipefail

CLAUDE_OPS_DIR="${CLAUDE_OPS_DIR:-$HOME/.claude-ops}"
MANIFEST="$CLAUDE_OPS_DIR/hooks/manifest.json"
SETTINGS="$HOME/.claude/settings.json"
BACKUP_DIR="$HOME/.claude/settings-backups"

DRY_RUN=false
CORE_ONLY=false
DIFF_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --dry-run)   DRY_RUN=true ;;
    --core-only) CORE_ONLY=true ;;
    --diff)      DIFF_ONLY=true ;;
    --help|-h)
      echo "Usage: setup-hooks.sh [--dry-run] [--core-only] [--diff]"
      exit 0
      ;;
  esac
done

# Colors
if [[ -t 1 ]]; then
  G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; B='\033[0;34m'; N='\033[0m'
else
  G=''; Y=''; R=''; B=''; N=''
fi
info()  { echo -e "${G}[setup-hooks]${N} $*"; }
warn()  { echo -e "${Y}[setup-hooks]${N} $*"; }
err()   { echo -e "${R}[setup-hooks]${N} $*" >&2; }

# ── Validate manifest exists ──
if [ ! -f "$MANIFEST" ]; then
  err "Manifest not found: $MANIFEST"
  err "Run install.sh first or create hooks/manifest.json"
  exit 1
fi

# ── Resolve ~ in paths to $HOME ──
_resolve_path() {
  echo "$1" | sed "s|^~/|$HOME/|"
}

# ── Build hooks JSON from manifest ──
# Groups hooks by event, preserving order from manifest.
build_hooks_json() {
  local filter='.hooks'
  if [ "$CORE_ONLY" = true ]; then
    filter='.hooks | map(select(.required == true))'
  fi
  # Skip project-specific hooks (they go in per-project settings)
  filter="$filter | map(select(.category != \"project\"))"

  python3 -c "
import json, sys, os

manifest = json.load(open('$MANIFEST'))
core_only = $( [ "$CORE_ONLY" = true ] && echo "True" || echo "False" )

hooks_by_event = {}
for h in manifest['hooks']:
    if h.get('category') == 'project':
        continue
    if core_only and not h.get('required', False):
        continue

    event = h['event']
    if event not in hooks_by_event:
        hooks_by_event[event] = []

    path = h['path'].replace('~/', os.path.expanduser('~') + '/')
    runner = h.get('runner', 'bash')
    command = f'{runner} {path}'

    entry = {'hooks': [{'type': 'command', 'command': command}]}
    if 'matcher' in h:
        entry['matcher'] = h['matcher']
    if 'timeout' in h:
        entry['hooks'][0]['timeout'] = h['timeout']

    hooks_by_event[event].append(entry)

# Canonical event order
event_order = [
    'UserPromptSubmit', 'PreToolUse', 'PostToolUse',
    'SubagentStart', 'SubagentStop', 'PreCompact', 'Stop'
]
ordered = {}
for ev in event_order:
    if ev in hooks_by_event:
        ordered[ev] = hooks_by_event[ev]
for ev in hooks_by_event:
    if ev not in ordered:
        ordered[ev] = hooks_by_event[ev]

print(json.dumps(ordered, indent=2))
"
}

# ── Generate full settings ──
# Merges manifest hooks INTO existing settings, preserving any hooks
# not in the manifest (e.g. project-specific hooks like pii-firewall).
generate_settings() {
  local new_hooks
  new_hooks=$(build_hooks_json)

  if [ ! -f "$SETTINGS" ]; then
    echo "{}" | jq --argjson hooks "$new_hooks" '. + {hooks: $hooks}'
    return
  fi

  # Smart merge: for each event, keep existing hooks not in manifest, then add manifest hooks
  python3 -c "
import json, os, sys

settings = json.load(open('$SETTINGS'))
manifest_hooks = json.loads('''$new_hooks''')

existing_hooks = settings.get('hooks', {})
merged = {}

# Collect all manifest hook basenames for dedup
manifest_basenames = set()
for event, entries in manifest_hooks.items():
    for entry in entries:
        cmd = entry['hooks'][0]['command']
        basename = os.path.basename(cmd.split()[-1])
        manifest_basenames.add(basename)

# For each event: keep non-manifest hooks, then add manifest hooks
all_events = set(list(existing_hooks.keys()) + list(manifest_hooks.keys()))
event_order = ['UserPromptSubmit','PreToolUse','PostToolUse','SubagentStart','SubagentStop','PreCompact','Stop']
ordered_events = [e for e in event_order if e in all_events]
ordered_events += [e for e in sorted(all_events) if e not in ordered_events]

for event in ordered_events:
    entries = []
    # Keep existing hooks that aren't in manifest (project-specific, custom)
    for entry in existing_hooks.get(event, []):
        cmd = entry.get('hooks', [{}])[0].get('command', '')
        basename = os.path.basename(cmd.split()[-1]) if cmd else ''
        if basename not in manifest_basenames:
            entries.append(entry)
    # Add manifest hooks
    entries.extend(manifest_hooks.get(event, []))
    if entries:
        merged[event] = entries

settings['hooks'] = merged
print(json.dumps(settings, indent=2))
" 2>/dev/null
}

# ── Diff mode ──
if [ "$DIFF_ONLY" = true ]; then
  new_settings=$(generate_settings)
  if [ -f "$SETTINGS" ]; then
    diff <(jq -S '.hooks' "$SETTINGS") <(echo "$new_settings" | jq -S '.hooks') || true
  else
    echo "$new_settings" | jq '.hooks'
  fi
  exit 0
fi

# ── Dry run ──
if [ "$DRY_RUN" = true ]; then
  info "Dry run — would install these hooks:"
  echo ""
  build_hooks_json | python3 -c "
import json, sys
hooks = json.load(sys.stdin)
for event, entries in hooks.items():
    print(f'  {event}:')
    for e in entries:
        cmd = e['hooks'][0]['command']
        matcher = e.get('matcher', '')
        m = f' (matcher: {matcher})' if matcher else ''
        print(f'    - {cmd}{m}')
    print()
"
  exit 0
fi

# ── Validate hook files exist ──
info "Validating hook files..."
_missing=0
python3 -c "
import json, os, sys
manifest = json.load(open('$MANIFEST'))
core_only = $( [ "$CORE_ONLY" = true ] && echo "True" || echo "False" )
missing = 0
for h in manifest['hooks']:
    if h.get('category') == 'project':
        continue
    if core_only and not h.get('required', False):
        continue
    path = h['path'].replace('~/', os.path.expanduser('~') + '/')
    if not os.path.isfile(path):
        print(f'  MISSING: {path} ({h[\"id\"]})', file=sys.stderr)
        missing += 1
sys.exit(missing)
" 2>&1 || _missing=$?

if [ "$_missing" -gt 0 ]; then
  warn "$_missing hook file(s) missing. Install them first or use --core-only."
  read -rp "Continue anyway? [y/N] " _ans
  [[ "$_ans" =~ ^[Yy] ]] || exit 1
fi

# ── Backup current settings ──
if [ -f "$SETTINGS" ]; then
  mkdir -p "$BACKUP_DIR"
  _backup="$BACKUP_DIR/settings.$(date +%Y%m%d-%H%M%S).json"
  cp "$SETTINGS" "$_backup"
  info "Backed up current settings to $_backup"
fi

# ── Install ──
new_settings=$(generate_settings)
echo "$new_settings" | jq '.' > "$SETTINGS"

_count=$(echo "$new_settings" | jq '[.hooks | to_entries[] | .value | length] | add')
info "Installed $_count hook entries across $(echo "$new_settings" | jq '.hooks | keys | length') events"
info "Settings written to $SETTINGS"
echo ""

# ── Post-install lint ──
info "Running lint to verify installation..."
echo ""
bash "$CLAUDE_OPS_DIR/scripts/lint-hooks.sh" || {
  warn "Lint found issues. Review above and fix manually."
}

echo ""
info "Restart Claude Code sessions for hooks to take effect."
