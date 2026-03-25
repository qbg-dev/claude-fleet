# Meta-Plan — "How are the project crons doing?"

## Context (~30s)

1. Read `cron/config.json` — get monitored project paths and panes
2. `tail -3 cron/logs/meta-summary.jsonl` — last meta-tick results
3. Read `cron/vision.md` — ground in the north star

## Discover (~5 min)

Launch 4 meta-explorers in ONE message (all opus, all parallel):

- **E1 tick-quality**: Score recent ticks from both projects
- **E2 pane-health**: Check if both agents are alive and active
- **E3 constitution-compliance**: Diff project constitutions against framework template
- **E4 framework-gaps**: Audit the framework itself for improvement opportunities

Wait for all 4.

## Synthesize (~1 min)

Cross-reference findings. Build action plan:

1. **Reminders needed?** — Which project crons are drifting? What specific violation?
2. **Framework improvements?** — What rules are unclear? What patterns should be extracted?
3. **Propagation needed?** — Good pattern in one project → framework → other project?

Prioritize: P0 = agent down/stuck, P1 = constitution violation, P2 = framework improvement.
