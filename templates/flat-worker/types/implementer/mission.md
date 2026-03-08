# {{WORKER_NAME}} — {{DESCRIPTION}}

## Role
{{ROLE_DESCRIPTION}}

## Mission
{{MISSION_DETAIL}}

## Issue Backlog
<!-- List issues this worker should fix, with severity and root cause analysis -->

## Workflow
```
LOOP:
  1. Claim next unblocked task from tasks.json
  2. Investigate root cause → write fix → deploy to test → verify
  3. Deploy to prod (if permitted) → verify
  4. Mark task complete, save findings to auto-memory
  5. Repeat until all tasks done (or graceful stop for perpetual workers)
```

**NEVER just report issues — FIX THEM.** You have full edit + deploy access. Use it.

## Key Source Files
<!-- Map the files this worker needs to understand -->
