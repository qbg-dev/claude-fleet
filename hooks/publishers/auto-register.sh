#!/usr/bin/env bash
# auto-register.sh — Auto-register every Claude session as a fleet worker.
#
# SessionStart hook. Fires once per session. Fast-path exits if:
# - Not in a git repo
# - Already a registered fleet worker (worktree branch worker/*)
#
# For new sessions in git repos:
# 1. Auto-creates .fleet/ dir + fleet.json if missing
# 2. Registers as {project}-{hash} worker in ~/.claude/fleet/{project}/
# 3. Outputs seed context (worker name, fleet state)

set -uo pipefail
trap 'exit 0' ERR

# Fast-path: already a fleet worker (on worker/* branch = manually created)
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [[ "$BRANCH" == worker/* ]]; then
  exit 0  # worker-session-register.sh handles these
fi

# Resolve project root (git root if available, otherwise cwd)
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "$PWD")
PROJECT_NAME=$(basename "$PROJECT_ROOT" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
# Strip worktree suffix if present
PROJECT_NAME="${PROJECT_NAME%-w-*}"

FLEET_DATA="${HOME}/.claude/fleet"
PROJECT_DIR="$FLEET_DATA/$PROJECT_NAME"

# Auto-create .fleet/ in project root if missing
if [[ ! -d "$PROJECT_ROOT/.fleet" ]]; then
  mkdir -p "$PROJECT_ROOT/.fleet"
fi

# Auto-create fleet.json if missing
FLEET_JSON="$PROJECT_DIR/fleet.json"
if [[ ! -f "$FLEET_JSON" ]]; then
  mkdir -p "$PROJECT_DIR"
  cat > "$FLEET_JSON" << EOF
{
  "project_name": "$PROJECT_NAME",
  "auto_registered": true
}
EOF
fi

# Generate worker name: {project}-{short-hash}
SHORT_HASH=$(head -c 4 /dev/urandom | xxd -p | head -c 4)
WORKER_NAME="${PROJECT_NAME}-${SHORT_HASH}"

# Check if we already have a worker for this pane (avoid duplicates on reconnect)
# Use CLAUDE_SESSION_ID if available from stdin
INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)

# Create worker directory
WORKER_DIR="$PROJECT_DIR/$WORKER_NAME"
mkdir -p "$WORKER_DIR"

# Write minimal config
cat > "$WORKER_DIR/config.json" << EOF
{
  "model": "opus",
  "type": "ad-hoc",
  "auto_registered": true,
  "project": "$PROJECT_NAME",
  "project_root": "$PROJECT_ROOT",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

# Write state
cat > "$WORKER_DIR/state.json" << EOF
{
  "status": "active",
  "worker_name": "$WORKER_NAME",
  "session_id": "$SESSION_ID",
  "registered_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

# Export worker name for other hooks to use
export WORKER_NAME

# Output seed context (injected into session)
cat << EOF
You are fleet worker **${WORKER_NAME}** in project **${PROJECT_NAME}**.

Fleet is active. You can use these MCP tools:
- \`mail_send(to, subject, body)\` — message other workers (account created on first use)
- \`mail_inbox()\` — check messages
- \`round_stop(message)\` — save checkpoint and end this work round
- \`save_checkpoint(summary)\` — snapshot state for crash recovery
- \`get_worker_state()\` — read fleet state

Use \`fleet rename {new-name}\` in the terminal to rename this worker.
EOF
