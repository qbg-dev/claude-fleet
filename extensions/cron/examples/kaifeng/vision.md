# 凯丰智谷 GTM — Vision & Continuous Improvement Plan

> **This document is the north star.** Every tick, every agent, every commit measures itself against this vision. Nothing is ever "done" — everything is continuous improvement toward this state. The cron system reads this file at `cron/vision.md` and uses it to guide autonomous decisions.

> **Quality is non-negotiable.** Code must be typed, tested, and clean. No `any`, no dead code, no skipped tests. Every tick leaves the codebase better than it found it. Go above and beyond — make everything excellent.

---

## 0. Agent SDK Fix (Immediate)

Fix `web/server/claude-agent.ts` to use correct TypeScript API:

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { Options } from '@anthropic-ai/claude-agent-sdk';

// query() takes { prompt, options? }
// Options fields: systemPrompt, model, permissionMode, allowedTools, cwd, maxTurns
// Auth via CLAUDE_CODE_OAUTH_TOKEN env var (Max subscription billing)
```

Files to modify: `web/server/claude-agent.ts`
Start server with: `CLAUDE_CODE_OAUTH_TOKEN=<token> KAIFENG_DB_PATH=/opt/kaifeng/data/leads.db npx tsx server/index.ts`

---

## A. Overnight Cron Plan (50+ rounds sustained)

### Architecture: Self-Healing Tick Loop

```
┌─ Watchdog (launchd/systemd, every 30s) ──────────────────┐
│                                                            │
│  Is Claude Code process alive?                             │
│  ├─ YES → check heartbeat file (<5min old?) → OK          │
│  ├─ NO → respawn with fresh context                        │
│  └─ STUCK → kill + respawn                                 │
│                                                            │
│  Each spawn = fresh context window                         │
│  State persistence = files + DB (not context)              │
└────────────────────────────────────────────────────────────┘
```

### Context Management

**Don't manage context manually.** Claude Code has built-in compaction — it auto-summarizes when context gets large. Just run a single long-lived `claude` session with the tick loop. Let compaction handle it naturally.

### Model: Opus Everything

**ALL agents use Opus.** No sonnet, no haiku. Unlimited budget. Explorers = Opus. Executors = Opus. Every subagent = Opus.

### Executor Scale

**4-5+ executors per tick.** Don't hold back. Run as many parallel executors as the work demands. Templates, emails, scraping, code quality, 公众号 articles — all at the same time.

### CRITICAL: Main Conversation Drives All Ticks

**Never delegate an entire tick to a background agent.** Background agents cannot launch sub-sub-agents reliably. The MAIN conversation must:

1. Phase 0: Gather context directly (Bash, sqlite3, git log)
2. Phase 1: Launch 8 Agent calls IN PARALLEL in ONE message (run_in_background=true, model=opus)
3. Phase 2: Synthesize after agents return
4. Phase 3: Launch 4-5 executor Agents IN PARALLEL in ONE message (run_in_background=true, model=opus, isolation=worktree)
5. Phase 4-5: Reflect, merge worktrees, test, commit, push
6. Loop → next tick immediately

This pattern was proven in ticks 1-3 (8+ parallel agents, successful) vs tick 4 attempt (single agent, no parallelism, failed).

### Overnight: Just Keep Running — NEVER STOP

Run continuously. Claude compacts automatically. Main conversation loops through ticks, launching parallel agents at each phase.

**There are NO diminishing returns.** Work is infinite:
- Chatbot stress testing is ALWAYS valuable — generate harder adversarial evals every tick
- Template quality can always improve — study award-winning designs, iterate
- Code quality can always improve — fewer `any`, better types, more tests, cleaner architecture
- Knowledge base can always deepen — research competitors, industry trends, policy updates
- Marketing copy can always sharpen — study what converts, A/B test angles

**When you feel stuck: launch 30 explorer agents.** They will find work. There is always something to improve. Do not stop. Do not say "diminishing returns." Do not propose stopping. The overnight engine runs until Warren wakes up and tells it to stop.

**DO NOT generate fake improvement.** Every change must be genuinely better than before. Refactoring for the sake of refactoring is fake. Generating templates identical to existing ones is fake. Adding tests for impossible edge cases is fake. But stress-testing the chatbot, improving template aesthetics, deepening knowledge base answers, reducing real code complexity — those are ALWAYS real improvement.
