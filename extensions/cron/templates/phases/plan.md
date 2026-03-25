# Plan — "What should we do?"

Everything that decides WHAT to do. The quality of Plan determines the ambition of Execute. A weak plan → a weak sprint.

## 1. Context (~1 min)

Run in parallel:

- `git log -10 --oneline` + `git diff --stat` — what changed recently?
- `tail -5 cron/logs/summary.jsonl` — tick history, determine tick number
- Read carry-forward from last Reflect: `cron/logs/rounds/tick-N-carryforward.json` — unfixed findings auto-elevate priority
- Read `cron/vision.md` — ground every decision in the north star
- Read `CLAUDE.md` — project conventions and architecture
- `TaskList` — any outstanding tasks?
- Check escalation queue — resolved items?

### Decision: Normal or Coherency?

`tick_number % coherency_review_every == 0` → **Coherency mode** (see below). Otherwise, normal mode.

## 2. Discover (~10 min)

Launch 15-20 explorer agents in ONE message. All opus, all parallel, all background.

**Minimum 8. Target 15-20. The minimum is not the goal — it's the floor.** Read `scoring-rubric.md`: 8 explorers scores 10/20, 15+ scores 15/20, 20+ scores 20/20. Aim high.

### Core Explorers (always run) `[FIXED]`

| Explorer   | Domain         | Key Checks                               |
| ---------- | -------------- | ---------------------------------------- |
| E1 harness | Infrastructure | Compilation, tests, lint, pre-commit     |
| E2 stress  | Stress Testing | Adversarial inputs, score multi-dimension|
| E3 codebase| Code Health    | File sizes, dead code, coverage, quality |
| E4 infra   | Production     | Server health, security, deps, resources |

### Rotating Explorers `[DYNAMIC]`

Add as many as the project warrants. Cycled during coherency ticks. Maintain a table with `Active?` column (YES/POOL).

### Explorer Rotation (every Plan, not just coherency)

Before launching explorers, read the carry-forward and last Reflect's consolidation notes:

1. Which rotating explorers produced 0 findings last cycle? → **Swap them out** (Active? → POOL)
2. Which pool explorers cover gaps revealed by last cycle's bugs? → **Swap them in** (Active? → YES)
3. **Minimum: 4 core + 4 rotating = 8 explorers.** But launch MORE if findings warrant it.
4. Rewrite mission.md for any explorer whose findings were stale or repetitive.

This keeps the observation layer adaptive — explorers evolve every cycle, not just on coherency ticks.

### Anti-stagnation Escalation

**Level 1 — Discovery Swarm**: <3 findings from all explorers → launch 15-20 agents with different lenses (see `explorers/discovery-swarm.md`). Each returns exactly ONE finding.

**Level 2 — Feature-Finding Agents**: If the discovery swarm ALSO returns <3 findings, launch 10 dedicated feature-finding agents. Each one:
- Reads the entire codebase with a specific user persona in mind
- Identifies a missing feature, UX improvement, or workflow gap
- Returns a detailed feature spec as a Finding with `category: "feature"`

This ensures there is ALWAYS an ambitious workplan. The question is never "is there work?" but "how hard did you look?"

### Explorer Lifecycle

1. Read `_defaults.md` for shared settings
2. Read `mission.md` from the explorer's directory
3. Run checks → produce `Finding[]` JSON
4. Report ONLY issues (skip passing checks)

Proceed when 80% of explorers complete (straggler policy).

## 3. Synthesize (~3 min)

Cross-reference ALL findings from ALL explorers:

1. **Load carry-forward** — auto-elevate priority: P3→P2, P2→P1, P1→P0
2. **Collapse duplicates** — e.g., harness failure + codebase gap → single root cause
3. **Build ambitious workplan** — each stream is a REAL chunk of work:
   - `{ domain, task, files_to_modify, explorer_refs, priority }`
   - Non-overlapping file ownership between streams (reduce merge conflicts)
   - Think: "what would a team of 10 engineers do in a day?" — that's one Execute phase

4. **Classify streams**: foreground (blocks Reflect) vs background (doesn't block)

---

## Coherency Mode (every Nth tick)

On coherency ticks, Discover is replaced with strategic planning:

### Research (3+ agents, parallel)
- **Competitors**: WebSearch for tools in this domain. What features do they have?
- **APIs + data sources**: New APIs, integrations relevant to the project
- **Best practices**: Industry trends, new techniques, academic papers

### Requirement Audit
If the project uses `user_requirements/` + `test/regression/`:
- For each requirement: implemented? tested? test accurate? spirit satisfied?
- Run all regression tests. Any failure = P0.
- Gap report → becomes execution findings.

### Explorer Rotation
- Evaluate each rotating explorer's utility over last N ticks
- Rotate out underperformers (Active? → POOL), rotate in fresh ones
- Rewrite stale mission.md files
- Max 2 rotations per coherency tick (stability)
- Core explorers (E1-E4) NEVER rotated — only missions sharpened

### Semantic Review (REVIEW.md agents)

Read `REVIEW.md` at the project root. This file contains semantic lint rules — things deterministic tests can't catch (interpretability, UX quality, tone, feedback surfaces, etc.).

1. Count the rules/sections in REVIEW.md → launch 3-8 review agents (1 per section or group)
2. Each agent gets: its assigned REVIEW.md rules + `git diff HEAD~{N}` (all changes since last coherency round)
3. Each agent reviews ALL recent changes against its rules and reports violations as `Finding[]`
4. Findings from semantic review go into Synthesize alongside explorer findings

This is the quality layer that sits above tests. Tests check "does it work?" — semantic review checks "does it work RIGHT?"

### Trend Analysis
- Analyze `summary.jsonl` — recurring failures? slow ticks? patterns?
- Staleness audit of auto-memory
- Are we improving or going in circles?

Synthesize proceeds normally after coherency discovery.
