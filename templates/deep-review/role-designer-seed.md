# Role Designer — Dynamic Team Composition

Analyze material and design the optimal review team. Write `{{ROLES_FILE}}` with specialist roles.

## Material

Read first 500 lines of: `{{MATERIAL_FILE}}`

**Type**: {{MATERIAL_TYPE}} | **Lines**: {{MATERIAL_LINES}} | **Worker budget**: {{MAX_WORKERS}}

## Project Review Rules

{{REVIEW_CONFIG}}

## Custom Review Spec

{{REVIEW_SPEC}}

## Available Specializations

**Code**: security (injection/IDOR/auth/CSRF/XXE), logic (conditions/off-by-one/type coercion), error-handling (swallowed/missing cleanup), data-integrity (non-atomic/race/cache), performance (N+1/unbounded/blocking I/O), ux-impact (loading states/error messages/race UX), silent-failure (try/catch analysis), claude-md (CLAUDE.md compliance)

**Content**: correctness, completeness, feasibility, risks, clarity, alternatives, priorities

**Universal**: architecture (coupling/abstraction/layers), improvement (reliability/readability)

You may invent **custom specializations** specific to the material (e.g., "jwt-auth-surface", "sql-injection-audit"). Custom specs should have specific attack vectors referencing actual patterns you saw.

## Output

Write `{{ROLES_FILE}}`:

```json
{
  "material_analysis": {
    "type": "code_diff|document|config|mixed",
    "languages": ["typescript"],
    "domains": ["auth", "api_routes"],
    "risk_signals": ["JWT changes", "SQL in routes"]
  },
  "roles": [
    {
      "id": "role-id-slug",
      "name": "Human-Readable Role Name",
      "description": "What this specialist focuses on",
      "attack_vectors": "Detailed investigation instructions. Trace X to Y, check Z...",
      "priority": "high|medium|low",
      "passes": 2
    }
  ],
  "total_workers": 8,
  "rationale": "Why this team composition for this material"
}
```

## Rules

1. **Total workers** = sum of `passes`. Must not exceed {{MAX_WORKERS}}.
2. **2–8 roles.** Focus beats breadth.
3. **High-priority roles get 2+ passes**, medium 1-2, low 1.
4. **Security + logic always included** for code changes.
5. **Attack vectors must be specific** to the material — reference actual files/functions/patterns.
6. **Custom > generic** when material has clear domain ("session-auth-specialist" > "security").
7. **Content-only material** → content specializations only.
8. **Small diffs** (<200 lines): 3-4 roles × 2 passes. **Large** (>1000): 6-8 roles.
9. **Rationale must justify** each role, referencing patterns seen.

After writing roles.json, say "ROLES DESIGNED" and stop.
