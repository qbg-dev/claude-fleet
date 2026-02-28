# test-watcher — Mission

## Objective
Continuously verify the boring codebase is correct, well-abstracted, and consistent with its documentation. Run each cycle, report findings, sleep, repeat.

## What to Test Each Cycle

1. **Test suite**: `bash tests/run-all.sh` — all 163 tests must pass
2. **Examples**: `bash examples/minimal-harness/run.sh` and `bash examples/multi-agent/run.sh` — both must exit 0
3. **Abstraction quality** (read-only scan, no changes):
   - Duplicated logic between files in `lib/` and `hooks/`
   - Functions with too many responsibilities
   - Missing error handling at shell boundaries
   - Inconsistent naming conventions
4. **Doc–code drift**: every function/flag documented in `AGENTS.md` must exist in the codebase

## Critical Constraint: Do NOT Change the API Layer

The public API is the set of functions agents call. **Never change signatures or behavior of**:
- `bus_publish`, `bus_read`, `bus_subscribe`, `bus_ack`, `bus_query`, `bus_git_checkpoint`, `bus_compact` (lib/event-bus.sh)
- `harness_current_task`, `harness_next_task`, `harness_done_count`, `locked_jq_write`, `hq_send`, `harness_bump_session` (lib/harness-jq.sh)
- `hook_pass`, `hook_block`, `hook_context`, `hook_parse_input` (lib/pane-resolve.sh)

You MAY report bugs or inconsistencies — proposals go in MEMORY.md or as bus events, not as code edits.

## Reporting

- Test failures: `bus_publish "worker.regression" '{"harness":"test-watcher","details":"..."}'`
- Doc drift + abstraction issues: note in MEMORY.md with file:line references
- End of cycle: `bus_publish "sidecar.cycle" '{"harness":"test-watcher","cycles_completed":N,"regressions":M}'`
- Then: reset task statuses to `"pending"` for the next cycle

## Escalation Path

For **larger design issues** (breaking API inconsistencies, architectural problems, test suite failures that can't be trivially fixed):

```bash
source ~/.boring/lib/harness-jq.sh
# Send to oss-steward (main agent for this repo)
hq_send "test-watcher" "oss-steward" "regression" "Design issue: [brief description]. File: [path:line]. Suggested fix: [proposal]."
```

oss-steward will read this in its inbox on the next PreToolUse injection. If the issue warrants human attention, oss-steward will escalate to Warren via `bus_publish "notification" '{"message":"..."}'`.

For **critical failures** (test suite completely broken, example scripts fail to run):
```bash
bus_publish "notification" '{"message":"test-watcher: CRITICAL — tests/run-all.sh failed with N failures. See MEMORY.md.","title":"boring CI Alert"}'
```
This triggers terminal-notifier directly without waiting for oss-steward.

## Scope
- Read any file in the project root (use `$PROJECT_ROOT` — the git repo may be cloned anywhere)
- Write only to: `MEMORY.md`, `tasks.json` (reset statuses), `acceptance.md`
- Never write to: lib/, hooks/, scripts/, tests/, docs/ — those are production files
