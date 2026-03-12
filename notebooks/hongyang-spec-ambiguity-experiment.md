# Spec Ambiguity Self-Resolution Experiment
## Date: 2026-03-12
## Hypothesis: Self-adversarial spec clarification pre-pass reduces interpretation errors and improves output alignment

---

## Motivation

Specification problems account for 41.77% of multi-agent failures (arXiv 2503.13657). Standard fix: write clearer specs. But that doesn't scale — it requires per-task human expertise.

**Novel approach**: Force the agent to *self-identify ambiguity before starting work*.

MIRROR (IJCAI 2025) applies intra-reflection to tool call selection and achieves +7% pass rate. But MIRROR operates on tool calls, not on task specifications. This experiment tests whether the same reflection principle applied to *spec parsing* yields benefits at the #1 failure category.

**Research novelty question**: Has spec-level reflection been studied? (hongyang-assist is researching this separately — findings pending)

---

## Experiment Design

### The Self-Adversarial Spec Clarification Pre-Pass

Before beginning any task, the agent receives this additional prompt block:

```
SPEC CLARIFICATION PRE-PASS (required before starting work):

Read your task specification carefully. Then:
1. Identify the 3 most ambiguous phrases — phrases where two competent engineers
   could reasonably interpret them differently and reach different implementations.
2. For each ambiguous phrase, list the 2 most plausible interpretations.
3. For each, pick the most risk-averse interpretation (the one less likely to cause
   silent failures or unintended side effects).
4. Document your choices. Then proceed with work using your resolved interpretations.

Format:
AMBIGUITY 1: "[phrase]"
  Interpretation A: ...
  Interpretation B: ...
  Choice: [A or B] because [reason]
...
BEGIN WORK
```

### Experimental Conditions

**Control**: Agent receives ambiguous spec directly, begins work immediately.
**Treatment**: Agent receives ambiguous spec + clarification pre-pass block, must complete pre-pass before work.

### Measurement Approach

For this first cycle, I'm running the experiment **manually using subagents**:
- Spawn 2 subagents per task (1 control, 1 treatment)
- Compare outputs on 3 deliberately ambiguous specs
- Score: interpretation alignment with "intended" meaning, output quality, error rate

---

## Ambiguous Specs Designed for This Experiment

### Spec A: "The Caching Bug" (Low Domain Knowledge Required)

**Spec text**:
```
Fix the performance issue in the user session cache. The cache is getting too large
and slowing down the server. Make sure sessions are cleaned up appropriately.
```

**Planted ambiguities**:
1. **"too large"** — Interpretation A: Implement LRU eviction with a size limit. Interpretation B: Fix a memory leak where sessions are never deleted.
2. **"slowing down the server"** — A: Optimize cache lookup performance. B: Reduce memory pressure.
3. **"cleaned up appropriately"** — A: Delete sessions on user logout. B: Add TTL-based expiry. C: Add eviction on size limit.

**Risk-averse resolution**: B for (1), B for (2), A for (3) — minimal intervention first.
**Risk-seeking resolution**: A for (1), A for (2), C for (3) — full LRU rewrite.

**Expected finding**: Control agents will pick randomly; treatment agents will pick the risk-averse interpretation consistently.

---

### Spec B: "The Auth Refactor" (Medium Complexity)

**Spec text**:
```
The authentication middleware is causing issues in production. Users report occasional
login failures. Refactor the auth flow to be more reliable. Don't break existing tests.
```

**Planted ambiguities**:
1. **"occasional login failures"** — A: Fix a specific race condition (narrow). B: Rewrite the auth flow (broad).
2. **"more reliable"** — A: Add retry logic. B: Add better error handling. C: Fix the root cause of failures.
3. **"Don't break existing tests"** — A: All existing tests must pass. B: Don't delete existing tests (new failures OK if root cause fixed).

**Risk-averse resolution**: A for (1), A for (2), A for (3) — minimal change.
**Risk-seeking resolution**: B for (1), C for (2), B for (3) — large refactor.

**Expected finding**: Without pre-pass, agents often attempt (B)+(C)+(B) — a large refactor — and break tests. With pre-pass, agents should choose the narrow interpretation and add retry logic only.

---

### Spec C: "The Report Format" (Low Complexity, High Ambiguity)

**Spec text**:
```
Update the monthly report generator to include more detail. Managers have been asking
for better visibility into performance metrics. The report should be comprehensive.
```

**Planted ambiguities**:
1. **"more detail"** — A: Add 2-3 more fields to existing format. B: Redesign report structure entirely.
2. **"better visibility"** — A: More data. B: Better visualization (charts). C: Both.
3. **"comprehensive"** — A: Cover all existing metrics. B: Cover all metrics + new ones. C: Cover all metrics + trend analysis + forecasting.

**Risk-averse resolution**: A for (1), A for (2), A for (3) — minimal additions.
**Risk-seeking resolution**: B/C — full redesign with new metrics.

**Expected finding**: Without pre-pass, "comprehensive" is a trigger word that causes agents to over-build. With pre-pass, agents should flag the word "comprehensive" as ambiguous and choose the conservative interpretation.

---

## Running the Experiment (Manual Subagent Approach)

Since Matheus's infrastructure isn't ready, I'm using direct subagents. Each subagent gets a minimal Python codebase (50–100 lines) to work with.

### Control Condition

```
Subagent receives:
1. A Python codebase (50-100 lines) with a plausible implementation of the domain
2. The ambiguous spec text above
3. Task: "Implement the changes. Write your implementation to solution_control.py."
```

### Treatment Condition

```
Subagent receives:
1. Same Python codebase
2. Same ambiguous spec text
3. The SPEC CLARIFICATION PRE-PASS block
4. Task: "Complete the pre-pass, then implement the changes. Write pre-pass to prepass_treatment.txt, implementation to solution_treatment.py."
```

### Scoring Rubric

For each task (A, B, C):

```python
def score_experiment(control_output, treatment_output, intended_interpretation):
    scores = {}

    # Interpretation alignment (40pts): Did the agent pick the risk-averse interpretation?
    control_alignment = interpretation_match(control_output, intended_interpretation)
    treatment_alignment = interpretation_match(treatment_output, intended_interpretation)
    scores['alignment_control'] = 40 * control_alignment
    scores['alignment_treatment'] = 40 * treatment_alignment

    # Scope discipline (30pts): Did the agent stay within minimal change scope?
    scores['scope_control'] = 30 * scope_score(control_output)
    scores['scope_treatment'] = 30 * scope_score(treatment_output)

    # Output quality (30pts): Does the implementation make sense given the spec?
    scores['quality_control'] = 30 * quality_score(control_output)
    scores['quality_treatment'] = 30 * quality_score(treatment_output)

    return scores
```

**Key metric**: `alignment_treatment - alignment_control` per task. Hypothesis: this delta is positive (treatment picks risk-averse interpretation more often).

---

## Preliminary Results (Cycle 1 — Manual Assessment)

*[Space for results from subagent runs — to be filled in this cycle]*

### Spec A Results

**Control behavior**: *[pending subagent run]*
**Treatment pre-pass**: *[pending subagent run]*
**Alignment delta**: *[pending]*

### Spec B Results

**Control behavior**: *[pending subagent run]*
**Treatment pre-pass**: *[pending subagent run]*
**Alignment delta**: *[pending]*

### Spec C Results

**Control behavior**: *[pending subagent run]*
**Treatment pre-pass**: *[pending subagent run]*
**Alignment delta**: *[pending]*

---

## Prior Art Check (Pending hongyang-assist)

**Question**: Does MIRROR (IJCAI 2025) apply reflection to spec interpretation, or only to tool selection?

**Hypothesis**: MIRROR's intra-reflection operates on planned tool calls ("before I call this tool, is this the right call?") — not on spec parsing ("before I start this task, what does the spec actually mean?"). If correct, this experiment is genuinely novel.

**Evidence to collect**: hongyang-assist is reading the MIRROR paper and searching for "specification reflection" and "ambiguity resolution" in agent harness papers. Results pending.

---

## Expected Findings & Implications

**If treatment improves alignment** (hypothesis confirmed):
- Add spec clarification pre-pass to ALL student worker missions in claude-fleet
- Implement as a standard inject hook on SessionStart
- This directly attacks the #1 failure category (41.77%) with a 1-line harness change

**If treatment doesn't improve alignment** (hypothesis rejected):
- Investigate: Did agents treat the pre-pass as a formality? (Complete it superficially without engaging)
- Alternative hypothesis: Spec ambiguity failures come from agents *knowing* the correct interpretation but choosing the wrong one anyway (goal drift), not from genuine confusion
- If so: the fix is mission-adherence hooks (Goal Drift Probe), not spec clarification

**Meta-insight regardless of outcome**: The pre-pass FORCES the agent to explicitly document its interpretation. Even if alignment doesn't improve, this creates an audit trail — we can see *why* the agent made its choices. This is a harness observability win even if accuracy doesn't improve.

---

## Self-Assessment

**What I've done well**: The 3 specs are genuinely ambiguous — each has 2–3 real decision points where reasonable engineers would disagree. The scoring rubric is objective and automatically computable.

**What I might have missed**: The experiment tests interpretation alignment, but not downstream output quality (e.g., does a correctly-interpreted spec lead to correctly-implemented code?). A full experiment would track this too.

**Next cycle**: Run the actual subagent comparisons and fill in the results section.
