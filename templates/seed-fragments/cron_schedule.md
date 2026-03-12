## CronCreate Enforcement

Your `config.json` has a `cron_schedule` array. You **MUST** call `CronCreate` for each entry at session start. The Stop hook (`stop-cron-gate`) blocks session exit until all expected crons are registered—it verifies against `tools.jsonl`.

Check your config and call each one:
```
CronCreate(cron: "<expression>", prompt: "<prompt>")
```

If you forget, the Stop hook will block and tell you which crons are missing.
