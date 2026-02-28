#!/usr/bin/env bash
# Check: no mock/placeholder data in written files

# Source config
CHECK_ENABLED_MOCK_DATA="${CHECK_ENABLED_MOCK_DATA:-true}"
[ -z "$CHECK_MOCK_DATA_FILE_PATTERN" ] && CHECK_MOCK_DATA_FILE_PATTERN='\.(ts|tsx|json)$'
[ -z "$CHECK_MOCK_DATA_MARKERS" ] && CHECK_MOCK_DATA_MARKERS='TODO|FIXME|mock|placeholder|dummy|fake|test123|lorem ipsum'

[ "$CHECK_ENABLED_MOCK_DATA" = "true" ] || exit 0
[ -z "$FILE_PATH" ] && exit 0
echo "$FILE_PATH" | grep -qE "$CHECK_MOCK_DATA_FILE_PATTERN" || exit 0
[ ! -f "$FILE_PATH" ] && exit 0
MOCKS=$(grep -cnE "($CHECK_MOCK_DATA_MARKERS)" "$FILE_PATH" 2>/dev/null || echo 0)
[ "$MOCKS" -gt 0 ] && echo "WARNING: $MOCKS potential mock/placeholder data in $(basename "$FILE_PATH")."
exit 0
