# Statusline Extension

Rich Claude Code statusline with session cost tracking, spending totals, git info, and optional fleet worker identity.

## Features

- **Session cost** with luxury tier emojis (🪙→💵→💳→✨→🎉→🎆→💎)
- **Spending totals** — hourly/daily/weekly with color-coded thresholds
- **Git branch** with dirty indicator
- **Model display** (Opus, Sonnet, etc.)
- **Transcript path** with session name
- **Fleet integration** (auto-activates when fleet is present):
  - Worker name and hierarchy (parent/children)
  - Current task display
  - Worktree detection

## Install

### Standalone (no fleet)

```bash
curl -fsSL https://raw.githubusercontent.com/qbg-dev/claude-fleet/main/extensions/statusline/install-standalone.sh | bash
```

### From fleet repo

```bash
bash extensions/statusline/install.sh
```

### Via fleet setup

```bash
fleet setup  # installs statusline automatically
```

## Spending Thresholds

### Session cost tiers

| Tier | Range | Emoji | Color |
|------|-------|-------|-------|
| Pocket change | ≤$0.10 | 🪙 | Green |
| Dollar bills | ≤$1.00 | 💵 | Bold Green |
| Card swipe | ≤$5.00 | 💳 | Yellow |
| Sparkling | ≤$20.00 | ✨ | Bold Yellow |
| Party | ≤$100.00 | 🎉 | Red |
| Fireworks | ≤$500.00 | 🎆 | Bold Red |
| Diamond | >$500.00 | 💎 | Bold Red |

### Aggregate spending colors

| Window | Yellow | Red |
|--------|--------|-----|
| Hourly | ≥$2 | ≥$10 |
| Daily | ≥$5 | ≥$20 |
| Weekly | ≥$30 | ≥$100 |

## Uninstall

```bash
bash extensions/statusline/install.sh --uninstall
```

## Dependencies

- `jq` — JSON processing
- `bc` — cost threshold comparisons
- `git` — branch/status display (optional)
- `tmux` — pane ID resolution (optional, for fleet features)
