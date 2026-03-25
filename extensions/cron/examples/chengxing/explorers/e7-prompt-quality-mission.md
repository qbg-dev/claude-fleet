# E7: Prompt Quality (system prompt health + LLM behavior)

## PROMPT

"Audit the system prompt and LLM behavior for ChengXing-Bot at /Users/kevinster/ChengXing-Bot:

1. Read src/api/system-prompt.ts — count chars, check for redundant/conflicting rules
2. Check if the LLM outputs JSON in text responses (should never happen per rule)
3. Check if suggestions are properly wrapped in <suggestions><s>...</s></suggestions> XML tags
4. Send 2 queries to production (http://8.135.53.164) and verify: clarification asked for ambiguous, no JSON in response, disclaimer present
5. Check for stale tool mappings in the 查询→工具映射 section

Report ONLY issues with file:line refs."

## RETIREMENT CRITERIA

Never retired.
