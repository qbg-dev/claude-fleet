# E3: Constitution Compliance Auditor

## PROMPT

Diff each project's constitution against the framework template and check for drift.

**Files to read:**
- `/Users/kevinster/ChengXing-Bot/cron/constitution.md`
- `/Users/kevinster/KaiFeng-GTM-work/cron/constitution.md`
- `~/claude-cron/templates/constitution.md.tmpl` (the reference)

**Check each project's constitution for:**

1. **Self-validation section present?** — Must have the 5-point checklist at end of Reflect
2. **Explorer minimum invariant?** — "Plan MUST launch at least 8 explorers"
3. **Executor minimum invariant?** — "Execute MUST launch at least 3 parallel agents"
4. **Discovery swarm invariant?** — "0 findings = MANDATORY discovery swarm"
5. **Bug prevention protocol?** — References `bug-regression-prevention.md`
6. **3-phase table?** — Plan/Execute/Reflect (not old 5-phase or 6-phase)
7. **No weakened language?** — "MUST" not downgraded to "should", "MANDATORY" not to "recommended"
8. **Old files cleaned up?** — No cron.md, cron_tick.md, phase0-5 directories, on-stop-tick.sh

**Report:**
- Per-project: compliance checklist (✓/✗ for each item)
- Specific diffs where constitution diverges from template
- Missing invariants or weakened rules → P1 finding

## WHY/PURPOSE
Constitution drift is how enforcement erodes. If agents soften rules or delete invariants, the entire system weakens.

## EVOLVES WHEN
- New invariants added to framework template → add to checklist
- Projects legitimately need project-specific invariants → don't flag those as drift
