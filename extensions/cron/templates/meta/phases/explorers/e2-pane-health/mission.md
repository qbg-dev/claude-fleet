# E2: Pane Health Monitor

## PROMPT

Check if both project cron agents are alive and following the constitution.

**For each pane (cron:1.0, cron:2.0):**

1. `tmux capture-pane -t "{pane}" -p -S -30` — read last 30 lines
2. Check for signs of life:
   - Spinner active? ("Working...", "Fermenting...", etc.)
   - Agents launched? ("X agents launched")
   - Recent tool calls?
3. Check for stagnation:
   - Same output as previous check? (compare to last meta-tick's pane snapshot)
   - Mentions "steady state", "converged", "nothing to do", "health check"?
   - Idle prompt with no activity?
4. Check for constitution following:
   - Did it mention reading constitution.md?
   - Did it launch explorers (look for "Explorer" or "agents launched")?
   - Is it in Plan, Execute, or Reflect? (look for phase indicators)
5. Process check:
   - Is claude process alive? (`tmux display-message -t "{pane}" -p '#{pane_pid}'` then `pgrep -P`)

**Report:**
- Per-pane: status (ACTIVE/IDLE/STUCK/DEAD), current phase, agent count, concerning patterns
- If STUCK or DEAD → P0 finding
- If health-check-only or stagnation language → P1 finding

## WHY/PURPOSE
Real-time detection catches drift AS IT HAPPENS, not after the tick is logged.

## EVOLVES WHEN
- New stagnation patterns observed → add detection rules
- False positives → tighten detection criteria
