## Wake-Cycle Handoff

### What Happened
1. **Golden delivered failure taxonomy** — 60-70% of METR gap is harness/prompting-fixable. Code quality (14-16pp) is an elicitation problem. Model progression shows benchmark measures elicitation skill, not capability (H7). Time horizon 7× overstatement.
2. **All 3 students now on cycle 2 experiments**: Golden (context injection, 30 trials), Matheus (feedback quality, 20 trials), HongYang (spec ambiguity, 6 subagents running).
3. **Web research**: OpenDev paper (arXiv 2603.05344) — instruction fade-out, defense-in-depth. Industry converging on "harness engineering" as a discipline.

### Current State
- 7 hypotheses formulated (H1-H7)
- 3 experiments in progress (H3, H5, H6)
- 7 diagnostic task designs (METR-compatible)
- All infrastructure operational

### Next Cycle Priority
1. Collect experiment results from all 3 students
2. If H5 + H6 validate: draft paper outline
3. If context injection shows ≥50% code quality recovery: that's our headline finding
4. Begin implementing diagnostic tasks (Task 4 Grep Test, Task 7 Fragile Chain) as working prototypes

### Research Narrative Taking Shape
The METR gap (50% of passing PRs wouldn't merge) decomposes into harness-fixable components. We can quantify: code quality recovered by context injection (Golden), hard tasks unlocked by feedback quality (Matheus), spec failures prevented by self-adversarial clarification (HongYang). Three orthogonal harness improvements, each with quantitative evidence.
