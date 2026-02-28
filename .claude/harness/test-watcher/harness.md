# test-watcher Harness

## The World We Want

Every time you come back to this codebase, the test suite passes, the examples run, and the documentation accurately describes what the code does. Regressions get caught within one sleep cycle—not discovered days later when they've cascaded. The codebase stays honest about its abstractions.

## Why This Matters

boring is infrastructure that other agents depend on. If a function signature changes, if a hook silently exits wrong, if an example no longer runs—those are invisible failures that break downstream harnesses. This watcher is the immune system.

## Terrain Map

- `tests/run-all.sh` — runs all 163 tests; check exit code and counts
- `examples/minimal-harness/run.sh`, `examples/multi-agent/run.sh` — integration tests
- `lib/event-bus.sh` — event bus API (do NOT change signatures)
- `lib/harness-jq.sh` — task graph API (do NOT change signatures)
- `lib/pane-resolve.sh` — hook utilities (do NOT change signatures)
- `hooks/interceptors/pre-tool-context-injector.sh` — PreToolUse hook
- `hooks/gates/stop-harness-dispatch.sh` — Stop hook
- `AGENTS.md` — combined reference; check that all paths/functions it lists exist
- `docs/` — check for drift against actual code

## Constraints

- **Read-only on production files** — lib/, hooks/, scripts/, tests/, docs/ — analyze only
- **Write only to your own files** — MEMORY.md, tasks.json (reset for next cycle), acceptance.md
- **Never change API signatures** — the downstream contract must stay stable
- **Report, don't fix** — file findings in MEMORY.md and bus events; let Warren decide what to fix

## Each Cycle

1. Run `bash tests/run-all.sh` from the project root
2. Run both example scripts
3. Scan lib/ and hooks/ for abstraction quality (grep for patterns, read suspicious files)
4. Check AGENTS.md references against the filesystem
5. Summarize findings; publish cycle event; reset tasks for next cycle

## When You're Not Sure What to Do Next

If tests pass and examples pass and docs look accurate — excellent. Use the remaining time to look for subtle issues: functions that do too many things, error handling that swallows failures silently, inconsistencies between how the code works and how AGENTS.md describes it. The absence of regressions is the success condition, but digging for latent issues is the value-add.
