# Cycle 2 Handoff — hong-yang

## Completed This Cycle

### 1. 7 Diagnostic Tasks for Harness Failure Probing
**File**: `notebooks/hongyang-diagnostic-tasks.md`

METR-compatible orthogonal probes, each with automatic scoring and partial credit rubric:
1. **Time Capsule Constraint** — context retention through compaction
2. **Refactoring Trap** — goal drift / scope creep probe
3. **False Victory** — shallow validation / false positive detection
4. **Grep Test** — tool selection EFFICIENCY as primary metric (novel — no existing benchmark measures this)
5. **Marathon Migration** — long-horizon state management (150 files, 30+ min)
6. **Elegance Test** — idiomatic code quality vs correct-but-verbose
7. **Fragile Dependency Chain** — 4-hop regression detection (novel — most probes use 1-hop)

Implementation order approved by Prof. Kung: Tasks 4 and 7 first.

### 2. Spec Ambiguity Self-Resolution Experiment
**File**: `notebooks/hongyang-spec-ambiguity-experiment.md`

Ran 6 subagents (2 per spec × 3 specs — control vs. treatment with pre-pass).

**Results**:
- Spec A (Cache): Control=MODERATE, Treatment=MINIMAL. Pre-pass prevented risky size cap. **Clear positive effect.**
- Spec B (Auth): Both=MINIMAL. Pre-pass created reasoning audit trail without changing output. **Neutral — but observability win.**
- Spec C (Report): Both=MODERATE. Treatment explicitly excluded trend analysis; missed `top_product`. **Slight over-conservatism.**

**Key finding**: Pre-pass is most effective when a "trigger word" in the spec normally causes over-building. No cases of serious harm — the mild over-conservatism in Spec C is a known tradeoff.

**Meta-finding**: Pre-pass creates auditable reasoning chain even when accuracy doesn't improve. This is a harness observability gain independent of accuracy.

**Novelty confirmed**: MIRROR=tool selection level, AMBIG-SWE=external dialogue. Ours=internal reflection at spec interpretation level. Three-way differentiation. No prior work in this exact space.

### 3. Task 4 (Grep Test) Working Prototype
**Files**: `experiments/task4-grep-test/generate_codebase.py`, `task.py`

- `generate_codebase.py`: generates 500-file Python codebase with 117 `legacy_auth()` calls in 50 files, deterministic via seed, writes ground truth JSON
- `task.py`: METR-compatible TaskFamily — `get_tasks()`, `get_instructions()`, `score()`, `intermediate_score()`
- Scoring validated: optimal (1 grep call)=1.000, good (8 calls)=0.920, poor (200 reads)=0.640, pathological (600 calls)=0.600
- Ready for baseline agent run

## Key Research Findings

1. **Pre-pass effect is real but conditional**: Works on ambiguous trigger words, neutral on clear bugs, slightly over-conservative on vague scope words like "comprehensive"
2. **Audit trail > accuracy improvement**: The reasoning record from pre-pass has value independent of whether it changes the output
3. **Matheus's Docker finding connects to Task 3**: Feedback quality may be the bottleneck for recovery from false positives. Pre-pass (before execution) + Docker feedback (after execution) likely synergize

## Next Cycle Priorities

1. **Task 3 (False Victory Probe)** — urgent given Matheus's Docker finding. Need to measure: does feedback quality alone explain the 2/2 vs 0/3 result? Or is there a spec interpretation component too?
2. **Run Task 4 against a real agent** — need baseline efficiency data before we can claim the metric is discriminating
3. **Third arm for Spec A**: add FEEDBACK condition (agent can run tests + iterate). Measure: pre-pass alone vs feedback alone vs both combined
4. **Pre-pass harness recipe**: write up as a fragment for `templates/fragments/spec-clarification-prepass.md`

## State
- Branch: worker/hong-yang @ 43ecead
- Cron: self-wake job 9ac90f7f running (every 10 min)
- hongyang-assist: completed and signed off
- All results reported to ht-kung
