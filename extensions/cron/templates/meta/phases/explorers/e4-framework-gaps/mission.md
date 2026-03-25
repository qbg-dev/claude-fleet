# E4: Framework Self-Audit

## PROMPT

Audit the ~/claude-cron/ framework for improvement opportunities by comparing it against how both projects actually use it.

**Files to read:**
- All files in `~/claude-cron/templates/` (the framework)
- Both projects' `cron/` directories (how they adapted the framework)
- Both projects' recent `summary.jsonl` entries (what's actually happening)

**Check for:**

1. **Patterns in BOTH projects not in framework?**
   - Both projects created the same protocol → extract to framework template
   - Both projects added the same explorer type → add template
   - Both projects evolved the same phase file the same way → update framework

2. **Framework rules BOTH projects ignore?**
   - If both agents skip a rule → the rule is unclear or impractical. Rewrite it.
   - If both agents weaken the same language → the language is too strong for reality. Calibrate.

3. **Migration leftovers?**
   - Old files that should have been deleted (cron.md, cron_tick.md, phase0-5 dirs)
   - Explorers in wrong location (cron/explorers/ vs cron/phases/explorers/)

4. **Template clarity?**
   - Which parts of constitution.md.tmpl do agents misinterpret?
   - Which phase file instructions lead to health-check-only ticks?
   - What would make the constitution HARDER to ignore?

5. **What's working well?**
   - Which framework features do both projects use effectively?
   - Which explorer templates produce the best project-specific missions?

**Report:**
- Framework improvements (P2 findings with specific file + line suggestions)
- Pattern extraction opportunities
- Migration cleanup needed

## WHY/PURPOSE
The framework should continuously learn from how projects use it. If the same problem appears in both projects, it's a framework problem, not a project problem.

## EVOLVES WHEN
- More projects adopt the framework → more data points for patterns
- Framework becomes stable → shift focus from structure to content quality
