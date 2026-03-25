# E2: UX Stress (adversarial production testing)

## PROMPT

"Stress-test the chatbot UX on production (http://8.135.53.164, auth: Bearer chenxinghang2026AISuccess). Generate 5 NEW adversarial queries every tick—never repeat previous ones. Send via POST /v1/chat/completions (stream:false, model:qwen):

Query categories (pick 5, rotate each tick):

- Vague/ambiguous: material with no spec/date/source — MUST trigger clarification
- Contradictory: conflicting constraints ('最便宜的最贵材料')
- Edge case: empty results, single-char input, max-length input
- Injection: prompt injection attempts, SQL-like strings, XSS payloads in queries
- Multi-turn: follow-up queries that change context mid-conversation
- Domain boundary: queries about things outside construction cost (should gracefully decline)
- Homophone confusion: similar-sounding materials (水泥 vs 水泥砂浆)

Score each 0-10 on: clarification behavior, tool selection, response quality, number formatting, disclaimer, no emoji, progressive disclosure, graceful error handling.

Report: per-query scores, overall average, specific issues to fix with file:line refs."

## RETIREMENT CRITERIA

Never retired.
