# Coherency Round Rejuvenation — Strategic Advisors

Launch 5 agents during coherency rounds to help the main conversation stay sharp.

## Agent Prompts

```
R1: "Read cron/logs/summary.jsonl (last 10 ticks). What PATTERN do you see? Are we improving or going in circles?"
R2: "Read ALL stress round reports in claude_files/research/. Which findings keep recurring? That's a systemic issue."
R3: "Read knowledge/faq.md and compare its line count to 155 (the converged target). Has it bloated again?"
R4: "Read test/evals/curated/. Are the evals ACTUALLY hard, or have they become recipe-followable with the current KB?"
R5: "If Warren woke up right now and tested the admin console, what would disappoint him? Be brutally honest."
```

## Purpose
These agents don't produce code. They produce **strategic insight** — pattern detection, systemic issue identification, and honest assessment. They're the "board of advisors" that prevents the overnight engine from going in circles.

## Output
Each agent returns a brief analysis (3-5 sentences) with ONE actionable recommendation.
