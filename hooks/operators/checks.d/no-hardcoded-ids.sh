#!/usr/bin/env bash
# Check: no hardcoded project/tenant IDs in code files

# Source config
CHECK_ENABLED_HARDCODED_IDS="${CHECK_ENABLED_HARDCODED_IDS:-true}"
[ -z "$CHECK_HARDCODED_IDS_FILE_PATTERN" ] && CHECK_HARDCODED_IDS_FILE_PATTERN='\.(ts|tsx)$'
[ -z "$CHECK_HARDCODED_IDS_FIELDS" ] && CHECK_HARDCODED_IDS_FIELDS='projectId|tenantId|companyId|organizationId'
CHECK_HARDCODED_IDS_MAX_MATCHES="${CHECK_HARDCODED_IDS_MAX_MATCHES:-3}"

[ "$CHECK_ENABLED_HARDCODED_IDS" = "true" ] || exit 0
[ -z "$FILE_PATH" ] && exit 0
echo "$FILE_PATH" | grep -qE "$CHECK_HARDCODED_IDS_FILE_PATTERN" || exit 0
[ ! -f "$FILE_PATH" ] && exit 0
# Look for bare numeric IDs that look like project/tenant IDs (2-3 digit numbers assigned to variables)
HARDCODED=$(grep -nE "($CHECK_HARDCODED_IDS_FIELDS)\s*[:=]\s*['\"]?\d{1,4}['\"]?" "$FILE_PATH" 2>/dev/null | head -"$CHECK_HARDCODED_IDS_MAX_MATCHES")
[ -n "$HARDCODED" ] && echo "WARNING: Possible hardcoded ID in $(basename "$FILE_PATH"): $HARDCODED"
exit 0
