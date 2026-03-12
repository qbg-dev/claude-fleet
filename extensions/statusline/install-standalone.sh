#!/usr/bin/env bash
# install-standalone.sh — One-liner statusline installer
# Usage: curl -fsSL <raw-url>/install-standalone.sh | bash
set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/qbg-dev/claude-fleet/main"
TARGET="$HOME/.claude/statusline-command.sh"
SETTINGS="$HOME/.claude/settings.json"

echo "Installing Claude Code statusline..."

# Check jq
if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required. Install: brew install jq (macOS) / apt install jq (Linux)"
  exit 1
fi

# Download script
mkdir -p "$HOME/.claude"
curl -fsSL "$REPO_RAW/extensions/statusline/statusline-command.sh" -o "$TARGET"
chmod +x "$TARGET"
echo "Downloaded statusline-command.sh"

# Merge into settings.json
if [ -f "$SETTINGS" ]; then
  _existing=$(jq -r '.statusLine.command // empty' "$SETTINGS" 2>/dev/null)
  if [ -n "$_existing" ]; then
    echo "statusLine already configured (preserving existing)"
  else
    _tmp=$(mktemp)
    jq '.statusLine = {"type": "command", "command": "bash ~/.claude/statusline-command.sh"}' "$SETTINGS" > "$_tmp" && mv "$_tmp" "$SETTINGS"
    echo "Added statusLine to settings.json"
  fi
else
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
echo "Done! Restart Claude Code to see the statusline."
echo "Uninstall: rm ~/.claude/statusline-command.sh && jq 'del(.statusLine)' ~/.claude/settings.json > /tmp/s.json && mv /tmp/s.json ~/.claude/settings.json"
