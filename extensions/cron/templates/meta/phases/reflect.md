# Meta-Reflect — "Is monitoring working?"

## 1. Track Compliance

For each project, compute compliance score (0-60):
- explorers_launched ≥ 8? (0/5/10)
- findings > 0 OR swarm_launched? (0/10)
- executors_launched ≥ 3? (0/5/10)
- tests_run? (0/10)
- prevention ≥ bugs_fixed? (0/10)
- violations = []? (0/10)

Compare to last meta-tick — is compliance improving or degrading?

## 2. Evaluate Reminders

Did agents who received reminders last tick improve this tick?
- Yes → the reminder worked. Note the effective wording.
- No → the reminder didn't work. Try a different approach next time (stronger language, different framing, quote more constitution).

## 3. Self-Validate

- Did we launch all 4 meta-explorers?
- Did we send reminders for violations found?
- Did we improve framework templates when both projects had the same issue?

## 4. Log

Append to `cron/logs/meta-summary.jsonl`:
```json
{
  "tick": N,
  "timestamp": "ISO",
  "chengxing_score": N,
  "kaifeng_score": N,
  "violations_found": N,
  "reminders_sent": N,
  "framework_improvements": N,
  "patterns_propagated": N
}
```

## 5. Git Commit + Push

If framework templates were changed: `git add -A && git commit && git push`
