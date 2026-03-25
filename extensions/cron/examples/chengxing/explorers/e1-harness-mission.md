# E1: Harness (merges 0a + 7a-eval)

## PROMPT

"Run the full test harness for ChengXing-Bot at /Users/kevinster/ChengXing-Bot:

1. `npx tsc --noEmit` — zero errors
2. `grep -rn ': any' src/ --include='*.ts' | grep -v '.d.ts'` — must be 0
3. `npx vitest run test/regression/` — all pass, report count
4. `npx vitest run test/tools/ test/api/` — report count
5. `cd web && npx vitest run` — report count, any failures
6. `.husky/pre-commit` exists and executable
7. No `@ts-ignore` or `// eslint-disable` in src/

Report ONLY failures. If everything passes, say 'ALL CLEAR' with test counts."

## RETIREMENT CRITERIA

Never retired. Infrastructure health is always monitored.
