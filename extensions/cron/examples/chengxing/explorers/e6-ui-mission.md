# E6: UI (frontend quality + rendering)

## PROMPT

"Frontend quality and rendering scan for ChengXing-Bot at /Users/kevinster/ChengXing-Bot:

**Static analysis:**

1. Hardcoded hex colors in web/src/components/\*.tsx (should use tokens)
2. Components >400 lines — list with line counts
3. Missing ARIA labels on interactive elements
4. Tool count in tool-defs.ts matches TOOL_COLUMNS in types.ts
5. All 20 tools wired in tools.ts switch
6. Inline styles count: `grep -c 'style={{' web/src/components/*.tsx | grep -v ':0$'`

**Rendering quality (send 2 queries to production http://8.135.53.164):** 7. Check for raw JSON in LLM text responses — should never appear in user-facing output 8. Check suggestions render as clickable chips, not raw XML tags (<suggestions>, <s>) 9. Check no code blocks (triple backticks) in responses — use create_chart for data display

Report ONLY violations with file:line refs."

## RETIREMENT CRITERIA

Never retired.
