# Scoring Rubric — Tick Quality & Semantic Review

Scores must carry semantic meaning. High scores are genuinely hard to obtain. Each range has concrete reference examples so scorers know exactly what qualifies.

---

## Tick Quality Score (0-100)

Scored by the meta-cron after each tick. The score measures how close the tick was to the IDEAL sprint.

### 0-20: Constitution Violation

The tick broke the rules. Examples:
- 0 explorers launched
- No test suite run
- Bugs fixed with zero prevention
- Health-check-only tick (no Plan/Execute/Reflect)
- 0 findings logged without a discovery swarm

**Reference**: ChengXing tick 3 — 0 explorers, 0 findings, 0 fixed. Score: 5.

### 21-40: Minimum Compliance

The tick met the letter of the constitution but not its spirit. Examples:
- Exactly 8 explorers (the minimum), no more
- Exactly 3 executors (the minimum), doing small patches
- Tests run but no prevention written
- Findings found but not all fixed (carry-forward growing)

**Reference**: A tick that launches 8 explorers, finds 2 things, fixes 1 inline, runs tests, deploys. Technically legal, but not a sprint. Score: 35.

### 41-60: Solid Sprint

The tick did real work with meaningful parallelism. Examples:
- 10-14 explorers launched (above minimum)
- 5-8 executors in worktrees (real parallel work)
- All findings fixed, prevention written for each
- Tests pass, deployed, carry-forward stable or shrinking
- Discovery swarm launched when explorers came up dry

**Reference**: A tick that launches 12 explorers, finds 6 issues, fixes all 6 in 5 parallel worktrees, writes 6 preventions, deploys. Carry-forward goes from 4 to 2. Score: 55.

### 61-80: Ambitious Sprint

The tick exceeded expectations. Hard to achieve — requires both scale AND quality. Examples:
- 15-20 explorers (including rotating + domain-specific)
- 10-15 executors (each doing substantial work, not small patches)
- All findings fixed + all carry-forward resolved (zero remaining)
- Prevention at Level 1-3 (type/lint/gate), not just Level 5 (tests)
- REVIEW.md semantic checks pass
- Framework improvement contributed back

**Reference**: A tick that launches 18 explorers, finds 10 issues, fixes all 10 in 12 parallel worktrees, writes 10 preventions (3 lint rules, 4 type constraints, 3 contract tests), resolves all carry-forward, deploys, pushes a pattern back to the framework. Score: 75.

### 81-100: Exceptional

Reserved for sprints that move the entire project forward by a visible leap. Almost never achieved — requires everything in 61-80 PLUS major structural improvement. Examples:
- 20+ explorers including discovery swarm
- 15+ executors doing major refactors or new features
- Zero carry-forward, zero violations, zero stale explorers
- Prevention at Level 1 (type system changes that make bug classes impossible)
- Major feature shipped end-to-end with tests + semantic review
- Framework templates improved based on this tick's learnings
- Coherency review completed with all sub-phases

**Reference**: A coherency tick that audits all requirements, rotates 2 explorers, runs 5 rejuvenation agents, fixes 15 findings across 12 worktrees, writes 8 type-level preventions, ships a major feature, resolves all carry-forward, and improves the cron framework. Score: 90.

### Scoring Formula

```
base = 0
+ explorers_launched:   0 → 0,  1-7 → 5,  8-14 → 10,  15-19 → 15,  20+ → 20
+ executors_launched:   0 → 0,  1-2 → 3,  3-4 → 6,    5-9 → 10,    10+ → 15
+ findings_fixed_ratio: 0% → 0, <50% → 3, 50-99% → 6,  100% → 10
+ prevention_ratio:     0% → 0, <50% → 3, 50-99% → 6,  100% → 10
+ tests_run:            no → 0, yes → 10
+ carry_forward_delta:  grew → 0, stable → 5, shrunk → 8, zero → 10
+ violations:           any → -10, none → 5
+ prevention_level_avg: 5-6 → 0, 3-4 → 5, 1-2 → 10    (lower = better)
+ semantic_review:      not run → 0, <7 avg → 3, 7-8 avg → 7, 9+ avg → 10

max = 100
```

---

## Semantic Review Score (0-10 per rule)

Each REVIEW.md rule is scored 0-10 by a review agent during coherency rounds. The score reflects how well recent changes follow the rule's SPIRIT, not just its letter.

### 0-2: Violation

The rule was actively broken. Examples:
- Interpretability: A flag was added with no explanation of why
- Feedback: User-facing judgment with no way to dispute it
- Tone: Emoji in production output, casual language in professional context

**What it looks like**: "The price was flagged as 异常偏低 but there's no formula, no threshold, no source data shown. The user has no idea why."

### 3-4: Minimal

Technically not broken, but barely compliant. Misses the spirit. Examples:
- Interpretability: Formula shown but inputs are opaque database IDs
- Feedback: A feedback button exists but captures no context
- Tone: Mostly professional but inconsistent

**What it looks like**: "The judgment shows '基于统计分析' but doesn't show which records, what the distribution looks like, or what threshold triggered the flag."

### 5-6: Adequate

Meets the rule. A reasonable engineer wouldn't complain. But not impressive. Examples:
- Interpretability: Formula + inputs shown, but calculation trace is missing
- Feedback: Feedback button captures the judgment and user comment
- Tone: Consistently professional

**What it looks like**: "Shows formula and inputs. You can figure out how it got the answer if you do the math yourself. But the system doesn't show its work step by step."

### 7-8: Good

Clear effort to follow the rule well. Above average. Examples:
- Interpretability: Full calculation trace — formula, inputs, step-by-step, result, confidence with reasoning
- Feedback: Feedback captures full context + gets routed to a review queue + affects future calculations
- Tone: Domain-expert level, terminology is precise, disclaimers are appropriate

**What it looks like**: "Every flagged item shows: formula used, all input values, the calculation, the result, why this threshold was chosen, sample size, and confidence level. A 造价师 could verify the math."

### 9-10: Exemplary

Best-in-class. Could be used as a reference for other projects. Very hard to achieve. Examples:
- Interpretability: Everything in 7-8, PLUS comparative context (how this compares to similar items), visual indicators, and the ability to drill into source data
- Feedback: Everything in 7-8, PLUS feedback loop closes (user sees their feedback was acted on), corrections improve future calculations automatically
- Tone: Indistinguishable from a senior domain expert's writing

**What it looks like**: "The flag shows the full calculation AND a mini-chart comparing this price to the distribution of similar items. The user can click any input to see the raw source record. There's a '标记为不准确' button that shows previous feedback on similar items."

### Overall Semantic Score

Average across all rules. Track over time:
- <5.0: Needs immediate attention — systemic quality issues
- 5.0-6.9: Adequate — meeting rules but not excelling
- 7.0-8.4: Good — consistent quality
- 8.5+: Excellent — very hard to sustain, indicates genuine care for quality
