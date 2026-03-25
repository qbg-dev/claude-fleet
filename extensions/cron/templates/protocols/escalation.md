# Escalation Protocol

Items needing human attention go to `escalation_queue.md` in the project root.

## When to Escalate

- Server down or unreachable for >2 ticks
- API billing/auth expired
- Client-blocking issue (broken feature that was demoed)
- Data corruption detected
- Security vulnerability found
- Any issue the cron cannot fix autonomously

## Format

Append to `escalation_queue.md` under `## Active`:

```markdown
### [PRIORITY] Description
- **Date**: YYYY-MM-DD
- **Tick**: N
- **Details**: What happened, what was tried
- **Impact**: What's broken, who's affected
- **Suggested action**: What the operator should do
```

## Rules

- Do NOT duplicate existing items
- Move resolved items to `## Resolved` section with resolution date
- Check queue every tick in Phase 1 pre-step
