# Execute — "Do it, all at once."

Maximum parallelism. This is the equivalent of a full engineering team's daily output — compressed into parallel LLM execution.

## Launch

Launch ALL streams in a SINGLE message. All use `model: "opus"`, `isolation: "worktree"`.

10-20 parallel agents, each one doing real, substantial work. As many agents as the workplan demands — do not hold back.

**Minimum 3. Target 10-20. The minimum is not the goal — it's the floor.** Read `scoring-rubric.md`: 3 executors scores 6/15, 5-9 scores 10/15, 10+ scores 15/15. Each executor should do SUBSTANTIAL work — a real feature, a real refactor, a real fix — not a one-line patch.

**NO EXCEPTIONS to the minimum.** "Fixes done inline" or "no critical findings" does NOT exempt you from launching 3 agents. If you have fewer than 3 findings, fill remaining slots with: test expansion, code quality improvements, explorer mission sharpening, documentation accuracy, or stress testing. The constitution requires `executors_launched >= 3` — a self-reported violation is still a violation.

## Each Agent Gets

- Specific findings with file:line refs from Plan
- Clear scope — which files to touch (non-overlapping)
- "Commit with descriptive messages after each meaningful change."
- The full project context (CLAUDE.md, relevant source files)

## Classification

**Foreground** = blocking work (Reflect waits for these):
- Changes to shared infrastructure (server entry, core modules, build config)
- Changes the test suite will evaluate
- Work that must be correct before deploy

**Background** = independent work (Reflect doesn't wait):
- Tests, docs, CSS-only polish, dead code removal
- Additive work that doesn't affect the test suite gate
- Research for the next Plan

Rule of thumb: if the test suite would catch a regression, it's foreground.

## Straggler Policy

Wait for all foreground streams. Don't wait for background stragglers.

## Anti-stagnation

If Plan produced 0 findings (all explorers green):
- DO NOT SKIP Execute
- Allocate streams to: test hardening, code quality, documentation accuracy, stress testing
- There is ALWAYS executable improvement work

## One Rule

Don't touch the same files in two streams. Plan's synthesis step assigns file ownership to prevent merge conflicts.
