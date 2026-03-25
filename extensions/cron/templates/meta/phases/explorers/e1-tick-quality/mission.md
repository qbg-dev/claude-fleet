# E1: Tick Quality Scorer

## PROMPT

Read summary.jsonl from both monitored projects and score recent ticks using the scoring rubric.

**Files to read:**
- `/Users/kevinster/ChengXing-Bot/cron/logs/summary.jsonl` (last 10 lines)
- `/Users/kevinster/KaiFeng-GTM-work/cron/logs/summary.jsonl` (last 10 lines)
- `~/claude-cron/templates/scoring-rubric.md` (the authoritative scoring reference)

**Score each tick (0-100) using the rubric formula:**

```
+ explorers_launched:   0 → 0,  1-7 → 5,  8-14 → 10,  15-19 → 15,  20+ → 20
+ executors_launched:   0 → 0,  1-2 → 3,  3-4 → 6,    5-9 → 10,    10+ → 15
+ findings_fixed_ratio: 0% → 0, <50% → 3, 50-99% → 6,  100% → 10
+ prevention_ratio:     0% → 0, <50% → 3, 50-99% → 6,  100% → 10
+ tests_run:            no → 0, yes → 10
+ carry_forward_delta:  grew → 0, stable → 5, shrunk → 8, zero → 10
+ violations:           any → -10, none → 5
+ prevention_level_avg: 5-6 → 0, 3-4 → 5, 1-2 → 10
+ semantic_review:      not run → 0, <7 avg → 3, 7-8 avg → 7, 9+ avg → 10
```

**Interpret scores against the rubric ranges:**
- 0-20: Constitution Violation — the tick broke rules
- 21-40: Minimum Compliance — letter of the law, not the spirit (minimums became ceilings)
- 41-60: Solid Sprint — real work with meaningful parallelism
- 61-80: Ambitious Sprint — exceeded expectations, hard to achieve
- 81-100: Exceptional — visible project leap, almost never achieved

**Report:**
- Per-project: last 5 ticks with scores + the score range label
- Trend: improving/degrading/stable (compare last 5 to previous 5)
- Flag any tick <30 (constitution violation territory)
- Flag any tick where minimums became ceilings (exactly 8 explorers, exactly 3 executors — score 21-40)
- Flag carry-forward items >3 ticks old (should be P0)
- Note which score components are dragging the total down

## WHY/PURPOSE
Scores must carry semantic meaning — a 35 means "technically legal but not a sprint" and an 75 means "genuinely ambitious work." The rubric prevents score inflation by making high ranges concretely hard to achieve. Trend detection catches both violations AND stagnation at the minimum.

## EVOLVES WHEN
- New invariants added to constitution → add scoring component
- Scores cluster at a range for >10 ticks → the range boundaries need recalibration
- A score component doesn't differentiate well → adjust weights
