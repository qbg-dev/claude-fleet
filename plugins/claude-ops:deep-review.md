---
description: "Bugbot-style multi-pass code review with majority voting, validation, and autofix. Launches 8 parallel review workers + 1 coordinator in a 'bug-bot' tmux window."
user_invocable: true
trigger: "deep-review code review bugbot multi-pass"
---

# Deep Review — Bugbot-style Code Review Pipeline

## What this does

Launches a multi-pass code review pipeline inspired by Cursor's Bugbot:

1. **8 parallel passes** — each reviews the diff with randomized chunk ordering (Opus, xhigh effort)
2. **Bucket similar findings** — group bugs pointing at the same issue
3. **Majority voting** — keep only findings reported by >=2 of 8 passes
4. **Validate** — coordinator reads source to confirm each bug is real
5. **Cross-run dedup** — skip bugs already reported in previous runs
6. **Autofix** — coordinator proposes and applies fixes for confirmed bugs
7. **Report** — structured markdown report with findings, votes, and fixes

## How to invoke

```bash
# Review changes since main (default)
bash ~/.claude-ops/scripts/deep-review.sh

# Review changes since a specific branch
bash ~/.claude-ops/scripts/deep-review.sh --base develop

# Review uncommitted changes
bash ~/.claude-ops/scripts/deep-review.sh --uncommitted

# Review a specific commit
bash ~/.claude-ops/scripts/deep-review.sh --commit abc123

# Review a PR
bash ~/.claude-ops/scripts/deep-review.sh --pr 42
```

## Window layout

Creates a `bug-bot` tmux window in the current session:
- **Pane 0**: Coordinator (Sonnet) — orchestrates pipeline, validates, proposes fixes
- **Panes 1-8**: Review workers (Opus) — each reviews the diff independently

## Integration with merge flow

As a **stop-check** on merge requests:
```bash
# Merger adds this before approving
add_stop_check "deep-review" "Run deep-review on worker branch before merge"

# After deep-review completes and report is clean:
complete_stop_check "deep-review" "0 confirmed bugs — clear to merge"
```

## Output

- **Findings files**: `$PROJECT_ROOT/.claude/state/deep-review/session-<id>/findings-pass-{1..8}.json`
- **Report**: `$PROJECT_ROOT/.claude/state/deep-review/session-<id>/report.md`
- **History**: `$PROJECT_ROOT/.claude/state/deep-review/history.jsonl` (cross-run dedup)

## Configuration

Environment variables:
- `DEEP_REVIEW_WORKER_MODEL` — model for review workers (default: `opus`)
- `DEEP_REVIEW_COORD_MODEL` — model for coordinator (default: `sonnet`)
- `NUM_PASSES` — number of parallel passes (default: 8, via `--passes N`)
