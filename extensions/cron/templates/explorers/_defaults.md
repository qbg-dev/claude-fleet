# Explorer Defaults

Shared settings for all explorer agents. Individual explorer files override these.

## Launch Settings

- `model: "opus"`
- `subagent_type: "Explore"`
- `run_in_background: true`
- Thoroughness: "very thorough"

## Rules

- Read-only — explorers do NOT modify code
- Report with file:line references where applicable
- Check `cron/logs/summary.jsonl` to avoid re-reporting known issues
- Report only NEW findings
- Include actionable recommendations, not just observations

## Prompt Template

Each explorer file contains:

- **PROMPT**: The actual agent prompt (sent verbatim)
- **WHY/PURPOSE**: Why this explorer exists, what gap it fills
- **EVOLVES WHEN**: Conditions that should trigger a prompt rewrite
- **RETIREMENT CRITERIA**: When this explorer should be moved to `_retired/`
