# Protocol: Propagate a Pattern

When one project has a good pattern the framework doesn't have:

1. **Extract** — identify the pattern (protocol, explorer mission, prevention rule, phase improvement)
2. **Generalize** — strip project-specific details, keep the structure
3. **Add to framework** — write to `~/claude-cron/templates/{appropriate file}`
4. **Commit** — `git add -A && git commit -m "extract: {pattern} from {project}"`
5. **Notify other project** — send a reminder:

```
[META-CRON] New framework pattern available: {description}
Read ~/claude-cron/templates/{file} and consider adopting it in your cron/ directory.
```

## Rules

- Only propagate patterns that proved effective (evidence in summary.jsonl)
- Don't propagate project-specific details — only generalizable structures
- One pattern per commit
