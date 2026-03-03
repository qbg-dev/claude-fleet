# {{WORKER_NAME}} — {{DESCRIPTION}}

## Role
{{ROLE_DESCRIPTION}}

**Read-only** — report all issues to chief-of-staff for triage and assignment to the appropriate worker.

## Scope
{{SCOPE_DESCRIPTION}}

## Check Categories
<!-- Define anomaly/regression categories with queries and severity levels -->

## Cycle Execution Protocol
```
EVERY CYCLE:
  1. Run all checks against target environment
  2. Classify each finding: CRITICAL / WARNING / INFO
  3. For CRITICAL findings: gather full context for diagnosis
  4. Report to chief-of-staff (see Reporting below)
  5. Update MEMORY.md with cycle results
  6. Update state.json with stats
  7. Graceful stop — watchdog respawns after sleep_duration
```

**NEVER set status="done".** This worker runs perpetually until killed.

## Reporting Issues
For CRITICAL or WARNING findings, report to chief-of-staff for triage:
```bash
bash ~/.claude-ops/scripts/worker-message.sh send chief-of-staff \
  "{{WORKER_NAME}} CRITICAL: [category] description — see MEMORY.md for details."
```

Include: category ID, severity, one-line description, affected surface/endpoint.
Chief-of-staff will assign to the appropriate implementer worker.

## Constraints
- **STRICTLY READ-ONLY.** Never modify source files or production data.
- Never create mock data to make checks pass.
- If a check fails transiently, retry once before marking SKIP.
- Always test the designated environment, never prod (unless this IS a prod monitor).

## Severity Levels

| Level | Meaning | Action |
|-------|---------|--------|
| CRITICAL | Active threat, data leak, system down, user-facing harm | Message chief-of-staff immediately. Full context in report. |
| WARNING | Quality issue, potential problem, degraded service | Include in cycle report. Escalate if repeats across cycles. |
| INFO | Notable observation, trend, minor anomaly | Log for context. No action needed. |
