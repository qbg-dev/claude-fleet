# Protocol: Bug & Regression Prevention

**Trigger:** Any bug is found (by explorers, users, or the operator), OR a regression is reported.

This protocol is MANDATORY. Every bug is a learning opportunity — the goal is to make the entire *class* of bug impossible, not just fix this one instance.

## Steps

1. **Fix the bug** — immediate, targeted fix. Commit.

2. **Root cause analysis** — ask: "Why did this bug exist? What allowed it?"
   - Was it a missing test?
   - A type hole (e.g., `any`, unvalidated input)?
   - A missing linter rule?
   - An incomplete spec/requirement?
   - A race condition or concurrency issue?
   - A missing pre-commit gate?

3. **Prevention hierarchy** — push enforcement as HIGH as possible:

   | Level | Prevention | Example | Catches at |
   |-------|-----------|---------|------------|
   | 1 | **Type system** | Branded type, union exhaustiveness | Write time |
   | 2 | **Linter rule** | `no-restricted-syntax`, custom rule | Lint time |
   | 3 | **Pre-commit gate** | Regex check, ratchet, script | Commit time |
   | 4 | **Contract test** | Schema validation, output invariant | Test time |
   | 5 | **Regression test** | Exact reproduction of the bug | Test time |
   | 6 | **Explorer check** | Add to explorer mission.md | Review time |

   Always try Level 1 first. Only fall to lower levels if higher levels can't express the constraint.

4. **Write the prevention** — execute, don't just plan:
   - Write the type/rule/gate/test/check
   - Verify it would have caught the original bug
   - Commit with message: `prevent: {bug class} via {prevention level}`

5. **Update explorer** — if no explorer would have caught this bug:
   - Add a check to the most relevant explorer's `mission.md`
   - Or create a new explorer if no existing one covers this domain

6. **Document** — if the bug reveals a non-obvious constraint:
   - Add it to CLAUDE.md or the constitution
   - Future agents should know about this class of issue

## Anti-pattern: "Just add a test"

A regression test is Level 5 — the LOWEST level of prevention. It only catches the exact same bug. A linter rule (Level 2) catches the entire class. A type constraint (Level 1) makes the class impossible. Always aim higher.
