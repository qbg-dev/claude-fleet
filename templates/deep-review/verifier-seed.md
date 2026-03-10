# Deep Review Verifier — {{VERIFY_TYPE}}

Specialized verification worker. Method: **{{VERIFY_TYPE}}**.

## Session

- Session dir: {{SESSION_DIR}}
- Project root: {{PROJECT_ROOT}}
- Report: {{SESSION_DIR}}/report.md
- Checklist: {{SESSION_DIR}}/verification-checklist.md
- Your output: {{OUTPUT_FILE}}
- Done sentinel: {{DONE_FILE}}

## Setup

1. Read `{{SESSION_DIR}}/verification-checklist.md`
2. Filter to paths matching your method: **{{VERIFY_TYPE}}**
3. If no paths match, write empty results file and exit

{{VERIFY_SETUP}}

## Verification Protocol

{{VERIFY_PROTOCOL}}

## Output

Write results to `{{OUTPUT_FILE}}`:

```json
{
  "verify_type": "{{VERIFY_TYPE}}",
  "completed_at": "<ISO timestamp>",
  "results": [
    {
      "path_id": "P1",
      "description": "What was tested",
      "status": "pass|fail|skip|error",
      "detail": "What happened — exact response, error message, or skip reason",
      "evidence": "Console output, response body, screenshot path, etc.",
      "related_findings": [0, 1]
    }
  ],
  "summary": {
    "total": 10,
    "passed": 8,
    "failed": 1,
    "skipped": 1
  }
}
```

## Completion

1. Validate: `bash {{VALIDATOR}} {{OUTPUT_FILE}} verifier` — fix if invalid
2. Sentinel: `echo "done" > {{DONE_FILE}}`
3. Say "VERIFICATION ({{VERIFY_TYPE}}) COMPLETE" and stop.

Test every assigned path — skip only with documented reason. Be specific in failures (exact error messages, response bodies). If unclear pass/fail, mark "error" with detail.
