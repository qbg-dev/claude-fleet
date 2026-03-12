#!/usr/bin/env bash
# install.sh — Install statusline for Claude Code
# Works standalone (no fleet required) or as part of fleet setup.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATUSLINE_SCRIPT="$SCRIPT_DIR/statusline-command.sh"
TARGET="$HOME/.claude/statusline-command.sh"
SETTINGS="$HOME/.claude/settings.json"

usage() {
  echo "Usage: bash install.sh [--uninstall]"
  echo ""
  echo "Install the Claude Code statusline with spending tracker."
  echo ""
  echo "Options:"
  echo "  --uninstall   Remove statusline from settings and delete script"
  echo "  --link        Symlink instead of copy (used by fleet setup)"
  echo "  --help        Show this help"
}

# ── Uninstall ──────────────────────────────────────────────────────────────
if [ "${1:-}" = "--uninstall" ]; then
  echo "Uninstalling statusline..."

  # Remove script
  if [ -f "$TARGET" ] || [ -L "$TARGET" ]; then
    rm -f "$TARGET"
    echo "  Removed $TARGET"
  else
    echo "  $TARGET not found (already removed)"
  fi

  # Remove statusLine from settings.json
  if [ -f "$SETTINGS" ]; then
    if command -v jq &>/dev/null; then
      _tmp=$(mktemp)
      jq 'del(.statusLine)' "$SETTINGS" > "$_tmp" && mv "$_tmp" "$SETTINGS"
      echo "  Removed statusLine from settings.json"
    else
      echo "  jq not found — manually remove \"statusLine\" from $SETTINGS"
    fi
  fi

  echo "Done."
  exit 0
fi

if [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

USE_LINK=0
if [ "${1:-}" = "--link" ]; then
  USE_LINK=1
fi

# ── Dependency check ──────────────────────────────────────────────────────
if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required but not found."
  echo "  macOS: brew install jq"
  echo "  Linux: apt install jq / yum install jq"
  exit 1
fi

if [ ! -f "$STATUSLINE_SCRIPT" ]; then
  echo "ERROR: statusline-command.sh not found at $STATUSLINE_SCRIPT"
  exit 1
fi

# ── Install script ────────────────────────────────────────────────────────
mkdir -p "$HOME/.claude"

if [ "$USE_LINK" = 1 ]; then
  ln -sf "$STATUSLINE_SCRIPT" "$TARGET"
  echo "Symlinked $TARGET → $STATUSLINE_SCRIPT"
else
  cp "$STATUSLINE_SCRIPT" "$TARGET"
  chmod +x "$TARGET"
  echo "Installed $TARGET"
fi

# ── Merge statusLine into settings.json ───────────────────────────────────
if [ -f "$SETTINGS" ]; then
  # Backup existing settings
  _backup_dir="$HOME/.claude/settings-backups"
  mkdir -p "$_backup_dir"
  _ts=$(date +%Y%m%d-%H%M%S)
  cp "$SETTINGS" "$_backup_dir/settings.$_ts.json"

  # Check if statusLine already configured
  _existing=$(jq -r '.statusLine.command // empty' "$SETTINGS" 2>/dev/null)
  if [ -n "$_existing" ]; then
    echo "statusLine already configured in settings.json (preserving existing)"
    echo "  Current: $_existing"
  else
    _tmp=$(mktemp)
    jq '.statusLine = {"type": "command", "command": "bash ~/.claude/statusline-command.sh"}' "$SETTINGS" > "$_tmp" && mv "$_tmp" "$SETTINGS"
    echo "Added statusLine to settings.json"
  fi
else
  # Create settings.json with just the statusline
  cat > "$SETTINGS" <<'EOF'
{
  "statusLine": {
    "type": "command",
    "command": "bash ~/.claude/statusline-command.sh"
  }
}
EOF
  echo "Created settings.json with statusLine"
fi

echo ""
echo "Statusline installed! Restart Claude Code to activate."
echo "Uninstall: bash $SCRIPT_DIR/install.sh --uninstall"
