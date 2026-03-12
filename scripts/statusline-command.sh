#!/bin/bash
# Thin wrapper — delegates to extensions/statusline/statusline-command.sh
exec bash "$(dirname "$0")/../extensions/statusline/statusline-command.sh"
