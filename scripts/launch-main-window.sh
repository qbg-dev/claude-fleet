#!/usr/bin/env bash
# launch-main-window.sh — Convenience alias for: launch-window.sh main
# Kept for backwards compatibility. Delegates entirely to launch-window.sh.
exec "$(dirname "$0")/launch-window.sh" main "$@"
