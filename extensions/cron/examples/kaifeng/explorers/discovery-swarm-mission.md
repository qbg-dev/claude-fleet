# Discovery Swarm — Anti-Stagnation Mechanism

Launch 15 agents in ONE message when obvious work is done. Each has a DIFFERENT lens:

## Agent Prompts

```
Agent 1:  "Read ALL Python files in src/. Find the weakest module — lowest quality, most fragile."
Agent 2:  "Read ALL TypeScript in wechat-bot/. Find dead code or unused exports."
Agent 3:  "Read knowledge/*.md. What question can a customer STILL not get answered?"
Agent 4:  "Read test/evals/curated/. Design a harder eval than any existing one."
Agent 5:  "WebSearch: what are TOP 3 产业园 in 大亚湾 doing that we're not?"
Agent 6:  "Read web/ admin console code. What tool is MISSING that an admin would need?"
Agent 7:  "Read data/email-subjects.json + marketing-copy.json. Write 5 better ones."
Agent 8:  "Read src/mailer/drip_sequences.py. Is the drip logic correct? Find a bug."
Agent 9:  "Read the WeChat webhook code. What edge case would crash it in production?"
Agent 10: "WebSearch: best AI chatbot for industrial real estate 2026. What do they have that we don't?"
Agent 11: "Read ALL test files. Which module has LOWEST coverage relative to complexity?"
Agent 12: "Read claude_files/operations-guide.md. Follow it step by step. What's wrong?"
Agent 13: "Read cron/logs/research/. TOP 3 actionable insights we haven't implemented."
Agent 14: "Read new_info/. What product info could we extract that's not in knowledge/?"
Agent 15: "If you were a 50-person precision mfg company in 龙华, what would convince you to move?"
```

## Usage
Each agent returns exactly ONE finding with priority + fix_hint.
Main conversation synthesizes 15 findings into 4-5 execution streams.

## When to Use
- When the last 3 ticks had <3 P0/P1 findings each
- When carry-forward is empty
- When you feel stuck
- During every 8th tick (regardless of state)
