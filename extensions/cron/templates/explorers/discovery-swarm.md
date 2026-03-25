# Discovery Swarm — Anti-Stagnation Mechanism

**Trigger:** <3 findings from all explorers, OR 3+ ticks since meaningful code change, OR you feel like work is drying up.

Launch 15 agents in ONE message. Each has a DIFFERENT lens. Each returns exactly ONE `Finding`.

## Generic Lenses (adapt prompts to your project)

```
Agent 1:  "Read ALL source files in the core module. Find the weakest function — least tested, worst edge cases."
Agent 2:  "Find dead code or unused exports across the entire codebase."
Agent 3:  "Read the main entry point / API surface. What input could a user send that would break it?"
Agent 4:  "Read the test suite. Design a harder test than any existing one."
Agent 5:  "WebSearch: best tools in this domain (2025-2026). What features do competitors have that we don't?"
Agent 6:  "Read all UI components (if any). What feature is MISSING that a user would expect?"
Agent 7:  "Read the most complex module. What edge case would return wrong data in production?"
Agent 8:  "Read the server/API routes. What concurrency bug could appear under load?"
Agent 9:  "Read config files and environment setup. What misconfiguration would cause a silent failure?"
Agent 10: "WebSearch: security vulnerabilities in our tech stack (2025-2026). Are we affected?"
Agent 11: "Read ALL test files. Which module has the LOWEST coverage relative to its complexity?"
Agent 12: "Read CLAUDE.md end to end. What claim is outdated or inaccurate?"
Agent 13: "Read cron/logs/summary.jsonl (last 10 ticks). What pattern? What keeps recurring?"
Agent 14: "Read documentation. What would confuse a new developer trying to contribute?"
Agent 15: "If you were a real user of this project right now, what would frustrate you most?"
```

## Rules

- Each agent reads the project fresh (no shared state)
- Each returns exactly ONE finding in the Finding schema
- Main conversation synthesizes all 15 into execution streams
- This mechanism means there are ALWAYS findings — the question is how hard you look
