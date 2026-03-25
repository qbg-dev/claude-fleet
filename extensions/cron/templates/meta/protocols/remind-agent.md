# Protocol: Enforce Constitution Compliance

When a project cron violates the constitution, don't just remind — **write the fix** into their cron system so it can't recur.

## Two enforcement levels

### Level 1: Write into their constitution.md (the cron tick)

The constitution IS the tick — it gets re-read every 5 minutes. Writing a rule into it means the agent WILL see it next cycle.

```bash
# Append an enforcement block to the project's constitution
cat >> "{project_dir}/cron/constitution.md" << 'ENFORCE'

## Enforcement Notice (from meta-cron, {timestamp})

**VIOLATION DETECTED**: {specific violation}
**RULE**: {quote the invariant}
**REQUIRED ACTION**: {what must happen next cycle}

This notice stays until the violation is resolved. Remove it only after a clean tick.
ENFORCE
git -C "{project_dir}" add cron/constitution.md && git -C "{project_dir}" commit -m "meta-cron: enforcement — {violation}"
```

Use for: behavioral drift (not launching enough explorers, skipping tests, health-check-only ticks).

### Level 2: Write into their cron/ folder

For structural issues, directly fix the project's cron files:

- **Missing protocol?** Copy from `~/claude-cron/templates/protocols/` into `{project_dir}/cron/protocols/`
- **Stale explorer?** Rewrite `{project_dir}/cron/phases/explorers/{explorer}/mission.md`
- **Wrong config?** Update `{project_dir}/cron/config.json`
- **Missing self-validation?** Append to their `constitution.md`
- **Old files not cleaned up?** Delete them directly
- **Weakened invariant?** Overwrite the section from the framework template

Always commit in the project's repo after writing:
```bash
git -C "{project_dir}" add -A && git -C "{project_dir}" commit -m "meta-cron: {description}"
```

Use for: structural gaps (missing files, broken config, migration leftovers, weakened rules).

### Always notify the pane

After writing fixes, notify so the agent re-reads immediately:

```bash
TMPFILE=$(mktemp)
cat > "$TMPFILE" << 'MSG'
[META-CRON ENFORCEMENT] I've written a fix into your cron/ files:
- {what was changed}
- {why — the violation}
Re-read cron/constitution.md now. The fix is already there.
MSG
tmux load-buffer "$TMPFILE"
tmux paste-buffer -t "{pane}"
sleep 0.3
tmux send-keys -t "{pane}" Enter
rm "$TMPFILE"
```

## Escalation

Same violation persists after 3 enforcement writes → escalate to Warren. The agent is either ignoring the constitution or the rule is fundamentally broken.
