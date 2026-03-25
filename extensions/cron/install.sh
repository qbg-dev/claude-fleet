#!/usr/bin/env bash
set -euo pipefail

# install.sh — Install cron extension for fleet
# Called by: fleet setup --extensions

EXTENSION_DIR="$(cd "$(dirname "$0")" && pwd)"
FLEET_DIR="$(cd "$EXTENSION_DIR/../.." && pwd)"

echo "Installing cron extension..."

# 1. Register cron worker type template
TYPES_DIR="$FLEET_DIR/templates/flat-worker/types"
if [[ ! -d "$TYPES_DIR/cron" ]]; then
  mkdir -p "$TYPES_DIR/cron"
  cat > "$TYPES_DIR/cron/defaults.json" << 'EOF'
{
  "sleep_duration": null,
  "model": "opus",
  "effort": "high",
  "description": "Autonomous improvement loop — Plan → Execute → Reflect sprint cycle"
}
EOF
  cat > "$TYPES_DIR/cron/mission.md" << 'EOF'
Read cron/constitution.md. This is your source of truth. Follow it exactly.
Read cron/vision.md. This is your north star.
Schedule the constitution via CronCreate (*/5 * * * *).
Begin your first Plan → Execute → Reflect cycle immediately.
EOF
  echo "  ✓ Registered 'cron' worker type"
fi

# 2. Register meta-cron worker type
if [[ ! -d "$TYPES_DIR/meta-cron" ]]; then
  mkdir -p "$TYPES_DIR/meta-cron"
  cat > "$TYPES_DIR/meta-cron/defaults.json" << 'EOF'
{
  "sleep_duration": null,
  "model": "opus",
  "effort": "high",
  "description": "Meta-cron monitor — checks project crons for constitution compliance, enforces via writes"
}
EOF
  cat > "$TYPES_DIR/meta-cron/mission.md" << 'EOF'
Read cron/constitution.md. You are the meta-cron — monitor project cron loops and improve the framework.
Schedule the constitution via CronCreate (*/10 * * * *).
Begin monitoring immediately.
EOF
  echo "  ✓ Registered 'meta-cron' worker type"
fi

# 3. Make cron_setup.md accessible
echo "  ✓ Cron setup available at: $EXTENSION_DIR/cron_setup.md"
echo "    Run 'fleet cron-setup' or read the file directly."

echo ""
echo "Cron extension installed."
echo "  To set up a cron loop: read $EXTENSION_DIR/cron_setup.md"
echo "  To create a cron worker: fleet create cron 'Read cron/constitution.md' --type cron"
echo "  To create a meta-cron: fleet create meta-cron 'Monitor project crons' --type meta-cron"
