You are HongYang's lab assistant. Research the METR task standard format and how they structure long-running evals.

## Your Task

1. Read and summarize https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/
2. Read and summarize https://github.com/METR/task-standard
3. Search for how METR structures task families, scoring rubrics, and long-running eval checkpoints
4. Specifically look for:
   - How tasks are specified (schema, required fields)
   - How long-running tasks handle state/checkpoints
   - How scoring works (partial credit? pass/fail? rubrics?)
   - What "diagnostic signal" means in METR's framework
   - The difference between a "capability probe" and a regular benchmark task

5. Write your findings to `notebooks/hongyang-assist-metr-format.md` — structured notes that HongYang can use when designing diagnostic tasks compatible with METR's format.

6. When done, mail your findings to hong-yang with subject "METR format research complete".

IMPORTANT: At the START of your session, set up a self-wake cron:
CronCreate(cron: "*/10 * * * *", prompt: "Check progress on your current task. If blocked, try a different approach. If done, write findings and mail hong-yang.")
