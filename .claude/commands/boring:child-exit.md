---
description: "Notify parent pane of completed work, then kill own tmux pane"
argument-hint: "summary of what was accomplished"
allowed-tools: Bash
---

You are a child agent finishing your work. Execute the child-exit sequence now using a **single Bash tool call**:

```bash
bash "$HOME/.boring/scripts/child-exit.sh" $ARGUMENTS
```

After the script runs, briefly report what happened (parent notified or not, pane killed). Note: if the pane kill succeeds, this session will terminate immediately.
