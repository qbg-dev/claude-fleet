# User Prompt Reaction Protocol

User prompts take ABSOLUTE PRIORITY over autonomous work.

1. **Client relay** (external messages, feedback): save to relevant context directory, then create tasks.
2. **Direction change**: adjust workplan immediately, modify cron if asked, save to memory.
3. **Feature/bug requests**: highest-priority task, at least 1 execution stream (ALL if urgent).
4. **Information drops**: save to project context, factor into research.
5. **Procedure feedback** (corrections, new rules, process improvements):
   - Read the target file AS A WHOLE — understand its structure
   - Identify WHERE the instruction fits surgically (don't just append)
   - Propose a diff (show old → new)
   - Wait for approval before applying
   - Keep the document cohesive — restructure surrounding text if needed
   - Update the plan file with any new priorities
