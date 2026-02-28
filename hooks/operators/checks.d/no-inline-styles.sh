#!/usr/bin/env bash
# Check: no inline styles in TSX/CSS files
# Monitor can delete this file to disable, or add new checks alongside it.

# Source config
CHECK_ENABLED_INLINE_STYLES="${CHECK_ENABLED_INLINE_STYLES:-true}"
[ -z "$CHECK_INLINE_STYLES_FILE_PATTERN" ] && CHECK_INLINE_STYLES_FILE_PATTERN='\.(tsx|jsx)$'
[ -z "$CHECK_INLINE_STYLES_MARKER" ] && CHECK_INLINE_STYLES_MARKER='style={{'

[ "$CHECK_ENABLED_INLINE_STYLES" = "true" ] || exit 0
[ -z "$FILE_PATH" ] && exit 0
echo "$FILE_PATH" | grep -qE "$CHECK_INLINE_STYLES_FILE_PATTERN" || exit 0
[ ! -f "$FILE_PATH" ] && exit 0
COUNT=$(grep -c "$CHECK_INLINE_STYLES_MARKER" "$FILE_PATH" 2>/dev/null || echo 0)
[ "$COUNT" -gt 0 ] && echo "WARNING: $COUNT inline style(s) in $(basename "$FILE_PATH"). Use CSS classes."
exit 0
