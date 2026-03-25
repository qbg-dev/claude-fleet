# E3: Codebase (merges 5a + 10b + 4a + 4b + 9a)

## PROMPT

"One-pass codebase health scan for ChengXing-Bot at /Users/kevinster/ChengXing-Bot:

1. Top 5 largest files in src/ (>500 lines = finding)
2. Stale CLAUDE.md: check tool count, test counts, architecture description match reality
3. Dead code: unused exports in src/api/tool-helpers.ts, unused imports
4. Test coverage: for each user_requirements/\*.md, verify matching test in test/regression/
5. Test rigor: spot-check the 3 lowest-rigor tests (score 2/5), suggest improvements
6. TODO/FIXME in src/ — any stale?

Report ONLY actual issues with file:line refs. Skip checks that pass."

## RETIREMENT CRITERIA

Never retired.
