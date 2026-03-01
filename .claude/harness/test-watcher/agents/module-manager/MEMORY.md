# Memory — test-watcher

Last cycle: 2026-02-28

## Cycle 1 Findings

### Test Suite: 18 failures in 2 suites (out of 25 suites)

#### Suite: test-registry.sh — 14 failures
**Root cause**: Tests hardcode project-specific harness names (`eval-external`, `eval-internal`,
`miniapp-chat`, `bi-opt`, `chatbot-agent`, `td-redteam`) that no longer exist in
`~/.boring/harness/manifests/`. These were from a previous Wechat project phase.
**Additional**: `harness_list_active()` returns empty because most manifests have empty
`.files.progress` — the function skips any manifest without a progress path.
**File**: `tests/test-registry.sh:19-80`. Doc/test drift; stale test, not a code bug.

#### Suite: test-progress-validator.sh — 3 failures
**Root cause**: Test expects `~/.boring/hooks/operators/progress-validator.sh` (an orchestrator
that dispatches checks.d/ scripts by passing `FILE_PATH` env var). This file does NOT exist —
only the sub-checks in `hooks/operators/checks.d/` exist (no-inline-styles.sh, no-mock-data.sh,
no-hardcoded-ids.sh). The orchestrator was never created or was deleted.
**Impact**: All 3 checks.d scripts are effectively dead code in the PostToolUse hook path —
nothing invokes them. Tests for inline-style detection, mock-data detection, and verification
artifact warnings all fail because there's no runner.
**File**: `hooks/operators/` — missing `progress-validator.sh`.

#### Suite: test-worker-dispatch.sh — 1 failure
**Root cause**: "Journal append" test checks for `journal.md` file with "SIDECAR DIRECTIVE"
text, but `worker_inject_journal()` was updated in v3 to route through `worker_send()` → bus
outbox instead of writing directly to journal.md.
**File**: `tests/test-worker-dispatch.sh:263-273`. Test has not been updated for v3 routing.

#### Suite: test-v3-rearchitecture.sh — 1 failure
**Root cause**: Test expects `.claude/scripts/hq-v2-seed.sh` at `PROJECT_ROOT/.claude/scripts/`.
Boring repo only has `oss-steward-seed.sh` and `test-watcher-seed.sh`. The test also checks for
13 Wechat project seeds (assistant-chat-ux, mod-customer, etc.) but silently passes by counting
mismatches as 0 (grep -q returns 0 on missing = not counted).
**File**: `tests/test-v3-rearchitecture.sh:176-200`. Test was written for Wechat project.

### Example Scripts

#### minimal-harness/run.sh — PASS ✓
#### multi-agent/run.sh — FAIL (exit 1)
**Root cause**: `scripts/scaffold.sh` creates nested seed path when harness name contains `/`:
`$PROJECT_ROOT/.claude/scripts/code-review/worker-alpha-seed.sh`. The mkdir only creates
`.claude/scripts/` (top level), not the subdirectory.
**Bug**: `scripts/scaffold.sh:~200` — `replace "$SEED_TMPL" > "$SEED_FILE"` fails because
parent dir of `$SEED_FILE` doesn't exist when harness name has slashes.
**Fix proposal**: Add `mkdir -p "$(dirname "$SEED_FILE")"` before writing seed file.

### C-3: Abstraction Quality (no critical issues)
- `event-bus.sh`: `bus_publish`, `bus_read`, `bus_query`, `bus_compact` are 20+ line functions
  but complexity is inherent to their domain (file locking, JSON manipulation, cursor tracking).
  Not a smell.
- No duplicated logic found between lib/ and hooks/ — hooks source lib functions properly.
- `2>/dev/null || true` used heavily in event-bus.sh — resilient but obscures debugging.
  Acceptable for production.
- `hooks/operators/checks.d/` scripts are modular but orphaned (no orchestrator invokes them).

### C-4: Doc–Code Drift
- AGENTS.md references accurate: `hooks/gates/stop-harness-dispatch.sh` ✓,
  `hooks/interceptors/pre-tool-context-injector.sh` ✓
- All documented API functions exist: bus_publish ✓, harness_current_task ✓, hq_send ✓, etc.
- `hooks/operators/progress-validator.sh` referenced in test but absent from AGENTS.md and
  `docs/hooks.md` — not drift in docs, but the test references a non-existent contract.

## Summary

| Category | Status |
|---|---|
| Test suite | 18 failures, 292 pass |
| minimal-harness example | PASS |
| multi-agent example | FAIL — scaffold subdir bug |
| Abstraction quality | OK (checks.d orphaned) |
| Doc–code drift | OK (API docs accurate) |

## Escalated Issues

Sent regression bus event for:
1. `hooks/operators/progress-validator.sh` missing — checks.d dead code
2. `examples/multi-agent/run.sh` fails — scaffold.sh subdir bug
3. Test suite: 3 stale test suites referencing deleted/moved code
