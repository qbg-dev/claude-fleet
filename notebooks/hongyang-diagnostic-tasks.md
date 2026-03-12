# Research Notebook — HongYang: Diagnostic Tasks for Harness Failure Probing
## Date: 2026-03-12
## Research Question: Design 5-7 diagnostic tasks that expose specific harness failure modes invisible to standard benchmarks

---

## Background & Design Philosophy

Standard benchmarks measure task completion. Diagnostic tasks measure **where and why agents fail**, and more importantly, **where good harnesses differ from bad ones**.

Key sources:
- METR (March 2026): ~50% of SWE-bench-passing PRs wouldn't be merged. Core failures: 15-20% core functionality, 10-15% regressions, 30-40% code quality
- METR time horizon metric: current models succeed on <10% of tasks taking humans >4 hours; "agents struggle with stringing together longer sequences more than lacking individual capabilities"
- Anthropic eval principles: unambiguous scoring, partial credit, pass@k for exploration
- From my cycle 1 findings: spec ambiguity (41.77%), coordination failure (36.94%), verification gaps (21.30%)

**Design constraints for METR compatibility:**
- Automatically scorable (code-based grader wherever possible)
- Each task isolates exactly ONE harness capability (orthogonal probes)
- Partial credit scoring via multi-component rubrics
- Human completion time calibrated and documented per task
- Score = f(accuracy, efficiency, quality) — not just binary pass/fail

---

## Task 1: Context Retention Probe — "The Time Capsule Constraint"

### Capability Probed
Does the harness preserve critical early context through context compaction? Specifically: when a constraint is stated once at the start of a long task, does it survive to the point where it's needed?

### Concrete Task Description
**Setup**: Agent receives a 200-line Python codebase with:
1. A constraint stated at the START: *"All database IDs must use the project's canonical ID format: prefix `TX-` followed by a 12-digit zero-padded integer. This is validated at the API gateway level and rejections are silent."*
2. A genuine bug to fix 25+ steps later: the `create_record()` function generates IDs using `uuid4()` instead of the canonical format
3. Unit tests that pass with EITHER format (the test suite doesn't know about the API gateway constraint)

The bug fix is technically straightforward (5 lines). The hard part is remembering the constraint from step 1 while deep in a 25-step debugging session.

**Human completion time estimate**: 8–12 minutes
**AI 50% success horizon**: ~30 minutes (agent must hold constraint through compaction)

### Good Harness vs. Bad Harness

| Behavior | Good Harness | Bad Harness |
|----------|-------------|-------------|
| Constraint handling | PreCompact hook re-injects constraint; agent references it when fixing | Constraint lost after compaction; agent uses uuid4 (tests pass, silently broken) |
| Test interpretation | Agent notes "tests pass but this may not satisfy the API gateway constraint" | Agent sees green tests, declares done |
| Output | `record_id = f"TX-{record_id:012d}"` | `record_id = str(uuid4())` |

### Scoring (0–100)

```python
def score(solution):
    points = 0
    # Primary (60pts): Does the fix use the canonical format?
    if re.search(r'TX-\{.*:012d\}|f"TX-\{.*12.*\}"', solution) or "TX-" in solution:
        points += 60
    # Secondary (20pts): Does the transcript reference the constraint at the point of fix?
    if constraint_referenced_near_fix(transcript):  # within 5 turns of the fix
        points += 20
    # Tertiary (20pts): Did agent note that tests passing != constraint satisfied?
    if uncertainty_noted(transcript):
        points += 20
    return points
```

**Diagnostic signal**: Score distribution separates harnesses by PreCompact hook quality. A harness with no context re-injection will cluster around 0–20. One with good re-injection clusters at 60–80.

### Implementation Difficulty
Medium. Requires crafting a codebase where the constraint is genuinely needed but the test suite doesn't enforce it. The "silent rejection" framing is critical — agents must know they can't verify the constraint locally.

---

## Task 2: Goal Drift Probe — "The Refactoring Trap"

### Capability Probed
Does the harness keep agents on-task when an attractive-but-out-of-scope opportunity presents itself? Maps directly to METR's 30-40% code quality failure category.

### Concrete Task Description
**Setup**: A Python caching module with two things:
1. **Target**: A trivial memory leak — `_cache` dict never evicts entries (5-line fix: add an eviction check)
2. **Decoy**: The same module has a suboptimal hash function that causes cache collisions under load (200-line performance optimization opportunity that any good engineer would want to do)

**Task spec**: *"The cache module has a memory leak. Fix it."*

The decoy optimization is:
- Genuinely interesting and non-trivial
- Mentioned in a nearby TODO comment: `# TODO(perf): hash collisions at scale — see issue #447`
- Correctly implemented, it improves performance 3×

A competent engineer looking at this code for the first time will immediately want to fix both. The harness must keep the agent on task.

**Human completion time estimate**: 6–10 minutes (4–5 min to fix leak, 5 min to resist temptation)

### Good Harness vs. Bad Harness

| Behavior | Good Harness | Bad Harness |
|----------|-------------|-------------|
| Scope adherence | Fixes exactly the eviction logic, commits, done | Fixes leak AND refactors hash function |
| Comment handling | Ignores the TODO comment | Creates a follow-up issue OR directly implements the optimization |
| Diff size | 5–8 lines changed | 50–200 lines changed |

### Scoring (0–100)

```python
def score(diff, transcript):
    points = 0
    leak_fixed = eviction_logic_present(diff)
    scope_maintained = lines_changed(diff) <= 15  # generous threshold
    hash_untouched = not hash_function_modified(diff)

    if leak_fixed:
        points += 50  # primary objective
    if scope_maintained and hash_untouched:
        points += 30  # scope adherence
    if "issue" in transcript.lower() or "TODO" in transcript.lower():
        # Agent noticed the TODO — did it defer or act?
        if deferred_to_issue(transcript):
            points += 20  # correct: noticed and deferred
        else:
            points -= 10  # incorrect: noticed and implemented
    return max(0, points)
```

**Diagnostic signal**: This test separates harnesses by mission-adherence hooks. Harnesses with clear scope boundaries score high; harnesses with open-ended "improve what you see" culture score low. The diagnostic maps to METR's code quality failure category.

### Implementation Difficulty
Low–Medium. The codebase just needs to be real enough. Key: the decoy must be genuinely tempting (real performance impact, documented in comments).

---

## Task 3: Recovery Probe — "The False Victory"

### Capability Probed
When the obvious first solution produces a superficial success (test passes) but isn't actually correct, does the harness force deeper validation? Tests error recovery and post-fix verification.

### Concrete Task Description
**Setup**: A test suite with 12 tests. Test #3 is failing with a `TypeError: unsupported operand type(s) for +: 'int' and 'str'`.

**Pre-planted trap**: The codebase has TWO bugs:
1. **Surface bug**: A type annotation is wrong (`age: str` should be `age: int`). Fixing this makes test #3 pass. It takes 2 minutes.
2. **Root bug**: The actual data pipeline deserializes JSON with incorrect type coercion, so even after the type annotation fix, `age` values arriving from production will still be strings. Test #3 passes because it uses a hardcoded int. The real fix requires 15 lines in the deserialization layer.

**Human completion time estimate**: 15–20 minutes (5 min for false fix, 10 min to realize it's wrong, 15 min for real fix)

### Good Harness vs. Bad Harness

| Behavior | Good Harness | Bad Harness |
|----------|-------------|-------------|
| Validation depth | Runs full test suite after fix, notes test #3 now passes; searches for source of `age` data | Runs only test #3, sees it pass, commits |
| Root cause analysis | Traces data flow to deserialization layer | Accepts the annotation fix as sufficient |
| Output quality | Fixes deserialization layer; includes test for production data path | Fixes type annotation only |

### Scoring (0–100)

```python
def score(diff, test_results, transcript):
    points = 0

    annotation_fixed = type_annotation_corrected(diff)
    deser_fixed = deserialization_fixed(diff)
    full_suite_run = all_12_tests_ran(test_results)
    root_cause_identified = "deserialization" in transcript.lower() or "json" in transcript.lower()

    if annotation_fixed: points += 10  # easy part, weak signal
    if full_suite_run: points += 20    # harness runs full suite
    if root_cause_identified: points += 30  # agent found root cause
    if deser_fixed: points += 40      # actually fixed it

    return points
```

**Diagnostic signal**: Harnesses that only run tests for the changed file score 10–30. Harnesses that enforce full validation score 50–100. Strongly distinguishes "test what you touched" vs "test everything" harnesses.

### Implementation Difficulty
Medium. Requires careful engineering of the test suite so test #3 passes after the false fix but a real production scenario would still fail. Must include a test simulating production data deserialization.

---

## Task 4: Tool Selection Probe — "The Grep Test"

### Capability Probed
When multiple tool paths are available with wildly different efficiency, does the harness guide agents toward the efficient path? Tests tool selection under complexity pressure.

### Concrete Task Description
**Setup**: A 500-file Python codebase. Task: *"Find all usages of the deprecated function `legacy_auth()` and report: (1) total count, (2) list of files, (3) line numbers."*

**Available approaches** (all correct, wildly different efficiency):
- `grep -rn "legacy_auth()"` — 1 tool call, instant, complete
- Read every Python file individually and search — ~500 tool calls, ~10× slower
- Write a Python script to walk the AST — 3 tool calls, 30× slower than grep
- Spawn a subagent to do the research — 20+ tool calls, 100× overhead

**Human completion time estimate**: 2 minutes
**Expected AI range**: 1 tool call (optimal) to 500+ tool calls (pathological)

### Good Harness vs. Bad Harness

| Behavior | Good Harness | Bad Harness |
|----------|-------------|-------------|
| Tool selection | Uses grep in first or second attempt | Writes Python, spawns subagent, or reads files individually |
| Call count | 1–3 tool calls | 20–500 tool calls |
| Time efficiency | Completes in seconds | Completes in minutes |
| Accuracy | 100% (grep is exact) | 100% but at 100× cost |

### Scoring (0–100)

```python
def score(tool_calls, accuracy):
    # Accuracy is binary: correct count + files + lines
    if not accuracy: return 0

    call_count = len(tool_calls)

    # Efficiency scoring: log scale (1 call = 100pts, 10 calls = 70pts, 100 calls = 30pts)
    import math
    efficiency = max(0, 100 - int(30 * math.log10(max(1, call_count))))
    return efficiency
```

**Diagnostic signal**: This is the ONLY task where accuracy is insufficient as a metric. A 500-tool-call solution that's correct is a harness failure. The efficiency ratio is the diagnostic.

**Why this matters (non-obvious)**: Tool selection efficiency compounds — a harness that wastes 100× on simple searches will waste 1000× on complex ones. This task identifies the efficiency floor of a harness.

### Implementation Difficulty
Low. Just needs a synthetic codebase with `legacy_auth()` calls seeded at known locations. Can be auto-generated.

---

## Task 5: Long-Running Probe — "The Marathon Migration"

### Capability Probed
Session management, progress tracking, and state continuity over genuinely long tasks (30+ minutes). Directly probes METR's time horizon metric and the "stringing sequences" failure mode.

### Concrete Task Description
**Setup**: A 150-file Python codebase. Task: *"Migrate all usages of the v1 API to v2. v1 uses `api.call(method, *args)`, v2 uses `api.invoke(method=method, params=args)`. There are 7 distinct calling patterns. Write a migration report when done."*

**Task properties**:
- Genuinely requires touching 150 files
- 7 calling patterns require pattern-specific handling (can't grep-and-replace)
- Some files have 10+ usages, some have 1
- Correct: ~450 total usages across 150 files
- Test suite has 200 tests (must pass all after migration)

**Human completion time estimate**: 45–90 minutes
**METR 50% success horizon**: This task is calibrated to be near the current 50% threshold (~1 hour)

### Good Harness vs. Bad Harness

| Behavior | Good Harness | Bad Harness |
|----------|-------------|-------------|
| Progress tracking | Maintains a list of done/remaining files; survives compaction | Loses track; re-migrates already-done files or stops at 60% |
| Checkpoint quality | Saves progress to file; on restart reads it | Relies on context window to remember progress |
| Commit cadence | Commits in batches (e.g., every 20 files) | Single commit at end (or loses work on crash) |
| Completion accuracy | 450/450 usages migrated | 280/450 (stops when "tired") |

### Scoring (0–100)

```python
def score(migration_report, test_results, git_log):
    usages_migrated = count_correct_migrations(migration_report)
    total_usages = 450
    tests_passing = sum(1 for t in test_results if t.passed)
    commit_count = len(git_log)

    accuracy = usages_migrated / total_usages  # 0–1
    test_score = tests_passing / 200           # 0–1
    process_score = min(1.0, commit_count / 7) # reward incremental commits

    return int(50 * accuracy + 30 * test_score + 20 * process_score)
```

**Diagnostic signal**: This task exposes the exponential reliability cliff. At 95% per-step accuracy, 150 sequential file migrations yield ~(0.95^150) ≈ 0.0006 probability of zero errors without recovery mechanisms. The difference between 60% and 90% on this task is almost entirely the harness's checkpoint/recovery quality.

### Implementation Difficulty
High. Requires a real or realistic synthetic codebase. Can be partially automated by generating the codebase programmatically. The 7 calling patterns need careful design to require distinct regex/AST handling.

---

## Task 6: Code Quality Probe — "The Elegance Test"

### Capability Probed
When multiple correct implementations exist with different quality profiles, does the harness produce idiomatic, appropriately concise code? Targets the 30-40% code quality failure category.

### Concrete Task Description
**Setup**: Task: *"Implement a thread-safe LRU cache class in Python with a configurable maximum size. It should support get(key), put(key, value), and delete(key). Write unit tests."*

**Valid implementations (all functionally correct)**:
1. **Idiomatic** (A): `collections.OrderedDict` + `threading.Lock`, ~25 lines
2. **Verbose** (B): Custom doubly-linked list + hash map, ~100 lines
3. **Over-abstracted** (C): `functools.lru_cache` adapter with a proxy class, ~15 lines but missing `delete()` semantics
4. **Buggy** (D): Any of the above without proper lock scoping (race condition under test)

**Human completion time estimate**: 15–20 minutes

### Good Harness vs. Bad Harness

| Behavior | Good Harness | Bad Harness |
|----------|-------------|-------------|
| Implementation choice | Chooses (A) — idiomatic, appropriately concise | Chooses (B) over-engineering, or (C) missing semantics |
| Thread safety | Properly scoped locks | Lock missing or incorrectly scoped |
| Test coverage | Tests eviction, concurrency, edge cases | Tests only basic get/put |

### Scoring (0–100)

```python
def score(code, tests, test_results):
    points = 0

    # Correctness (40pts)
    if all_tests_pass(test_results): points += 40

    # Thread safety (20pts)
    if thread_safe_stress_test_passes(code): points += 20

    # Implementation quality (40pts)
    loc = count_lines_of_code(code)
    uses_ordereddict = "OrderedDict" in code
    uses_lock = "threading.Lock" in code or "RLock" in code

    if uses_ordereddict and uses_lock:
        points += 30  # idiomatic choice
    elif loc < 50:
        points += 15  # concise, not idiomatic
    elif loc > 80:
        points += 5   # correct but verbose

    # Test quality (10pts)
    if tests_concurrency(tests): points += 10

    return points
```

**Diagnostic signal**: The code quality dimension (40pts) specifically probes whether the harness produces idiomatic code or just correct code. This is the key insight from METR's 30-40% code quality failure finding.

**Why this is non-obvious**: Most code quality evals check style (PEP8, line length). This probes *architectural judgment* — whether the agent picks the right abstraction level. That's a harder signal to fake with style checkers.

### Implementation Difficulty
Low. The task is synthetic and self-contained. The scoring requires a thread-safety stress test (e.g., 100 concurrent put/get operations, check for race conditions).

---

## Task 7: Regression Probe — "The Fragile Dependency Chain"

### Capability Probed
Does the harness run full test suite coverage (not just tests for changed files) before declaring success? Maps directly to METR's 10-15% regression failure category.

### Concrete Task Description
**Setup**: A codebase with a 4-level dependency chain:
```
payment.py → billing.py → invoice.py → report.py
```

**Task**: *"Fix the bug in `payment.py` where `calculate_tax()` returns `None` instead of `0.0` when no tax applies."*

**Fix**: 3-line change in `payment.py`

**Pre-planted regression**: The fix changes `calculate_tax()` to return `0.0` (was `None`).
- `billing.py` has `total = amount + (tax or 0)` — works with both None and 0.0
- `invoice.py` has `has_tax = bool(payment.calculate_tax())` — works with both
- `report.py` has `tax_line = f"Tax: ${tax:.2f}"` where `tax = calculate_tax()` — this ONLY works with floats, not None

`test_payment.py` passes ✓
`test_billing.py` passes ✓
`test_invoice.py` passes ✓
`test_report.py` FAILS ✗ — but only if you run it

**Human completion time estimate**: 10–15 minutes (5 min fix, 10 min to catch regression)

### Good Harness vs. Bad Harness

| Behavior | Good Harness | Bad Harness |
|----------|-------------|-------------|
| Test scope | Runs all 4 test files before declaring done | Runs only test_payment.py (the changed file) |
| Regression detection | Catches test_report.py failure, traces to dependency | Declares success after test_payment.py passes |
| Final output | Fixes payment.py bug + patches report.py to handle 0.0 | Fixes payment.py bug only, misses regression |

### Scoring (0–100)

```python
def score(diff, test_log, transcript):
    points = 0

    original_bug_fixed = null_return_fixed(diff)
    regression_detected = "report" in transcript.lower() and test_log_includes("test_report")
    regression_fixed = report_py_handles_float(diff)
    full_suite_run = all_test_files_ran(test_log)

    if original_bug_fixed: points += 30
    if full_suite_run: points += 25
    if regression_detected: points += 25
    if regression_fixed: points += 20

    return points
```

**Diagnostic signal**: This test has binary structure — either you run all tests or you don't. Harnesses that run only changed-file tests will score 30 (fixed the bug, missed everything else). Harnesses with full-suite coverage score 80–100. This maps to real-world production failures: the agent was "done" but shipped a regression.

**Why the dependency chain matters (non-obvious)**: Most regression tests put the regression in the same file or an obvious direct dependency. This test chains through 4 levels — the regression is 3 hops away. This is representative of real codebases where regressions hide in distant consumers.

### Implementation Difficulty
Low–Medium. The codebase is small (4 files, ~200 lines total) and the dependency chain is explicit. The key is engineering the bug so `test_report.py` is the ONLY failing test after the fix.

---

## Synthesis: What These Tasks Measure Together

| Task | Failure Mode Targeted | METR Category | Failure % |
|------|----------------------|---------------|-----------|
| Context Retention | Constraint loss through compaction | Functionality | 15-20% |
| Goal Drift | Scope creep beyond stated task | Code quality | 30-40% |
| False Victory | Shallow validation, false positives | Functionality | 15-20% |
| Tool Selection | Efficiency blindness | Harness quality | Unmeasured |
| Marathon Migration | Long-horizon state management | All categories | 50%+ |
| Elegance Test | Idiomatic code production | Code quality | 30-40% |
| Fragile Chain | Regression detection depth | Regressions | 10-15% |

### Key Non-Obvious Properties of This Task Set

**1. Orthogonality**: Each task isolates exactly one harness capability. A harness can score 100 on Goal Drift and 10 on Tool Selection — this is the point. Orthogonal probes localize failures precisely.

**2. The Efficiency Probe (Task 4) is Unique**: All existing benchmarks measure accuracy. This is the only task in common evaluation suites that measures efficiency as the primary signal. A 500-tool-call correct answer is a harness failure.

**3. The Dependency Chain Depth (Task 7) is Calibrated**: Most regression probes use 1-hop dependencies. This uses 4-hop. Calibrating the chain depth to 4 ensures that "run tests for all imported files" is insufficient — you need to run the FULL suite.

**4. Marathon Migration (Task 5) is a True Stress Test**: It can't be solved by any amount of clever prompting. It requires actual infrastructure (progress files, incremental commits, checkpoint recovery). This makes it the most discriminating test for harness engineering quality.

**5. All 7 Tasks are Automatically Scorable**: No human judgment required. Each scoring function is deterministic given the agent's output. METR compatibility confirmed.

---

## METR Compatibility Notes

- **Schema format**: Each task maps to 2–3 functions: `setup_environment()`, `get_instructions()`, `score(output)`. Compatible with METR task-standard.
- **Partial credit**: All 7 tasks use component scoring (not binary). This enables rubric-based partial credit aligned with METR's messiness factors.
- **Human calibration**: Time estimates provided for each task, enabling METR's time-horizon analysis.
- **Automatic scoring**: All scoring is code-based. The only judgment call is defining what "correct migration" means in Task 5, which can be specified via an expected output file.

---

## Proposed Next Steps

1. **Implement Tasks 4 and 7 first** (lowest implementation difficulty, highest diagnostic signal-to-noise ratio)
2. **Task 5 requires a synthetic codebase generator** — worth building as a shared tool for the lab
3. **Validate each task with manual run first** (check: does the task have the intended difficulty? Does the trap work?)
4. **Cross-reference with Golden's failure taxonomy** to ensure we're covering the same categories
5. **Context Injection Paradox experiment** (from cycle 1) could be added as Task 8 once METR format is confirmed

---

### Self-Assessment

**Strengths**: Tasks are orthogonal, automatically scorable, and each has a non-obvious diagnostic signal that goes beyond pass/fail. The Elegance Test (Task 6) and the Fragile Chain depth (Task 7) are genuinely novel contributions that aren't in standard eval suites.

**Potential gaps**:
- Tasks 1 and 5 require real codebases or high-quality synthetic ones — implementation effort is significant
- No adversarial inputs (prompt injection, contradictory instructions) — these could form a Task 8
- Task 3 (False Victory) may be too similar to Task 7 (Regression) — consider merging or sharpening the distinction
