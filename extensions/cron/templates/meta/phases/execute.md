# Meta-Execute — "Enforce compliance + improve framework"

## 1. Enforce on Drifting Agents

For each project with violations, follow `cron/protocols/remind-agent.md`:

**Level 1 — Behavioral drift** (skipping explorers, health-check ticks, no tests):
Write an Enforcement Notice directly into the project's `cron/constitution.md`. The constitution IS the tick — the agent will see it next cycle. Commit in the project's repo.

**Level 2 — Structural gaps** (missing files, wrong config, weakened rules, migration leftovers):
Write the fix directly into the project's `cron/` folder. Copy missing protocols, rewrite stale explorers, delete old files, restore weakened invariants. Commit in the project's repo.

**Always notify** the pane via tmux after writing, so the agent re-reads immediately.

## 2. Update Framework Templates

If the same violation appears in BOTH projects → the framework template is unclear. Fix the source:
- Edit `~/claude-cron/templates/` to make the rule clearer
- Stronger language, concrete examples, explicit minimums
- Commit in ~/claude-cron/: `enforce: {what was unclear} — {how it's clearer now}`

## 3. Propagate Patterns

If one project has a good pattern the other doesn't:
1. Extract the pattern into the appropriate framework template
2. Write it into the other project's cron/ folder (Level 2)
3. Notify both panes

## Rules

- Write fixes into projects. Don't just suggest — enforce.
- Framework template changes prevent future drift across ALL projects.
- One commit per fix (micro-commits, clear messages).
- After 3 failed enforcements for the same violation → escalate to Warren.
