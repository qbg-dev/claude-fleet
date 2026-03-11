# Doc Sync Verification Checklist

Run this checklist before committing changes that touch CLI commands, documentation, completions, or tests.

## How to use

1. Read this checklist
2. For each item, inspect the relevant files and record your findings
3. Write proof XML to the path given by: `bash scripts/verification-hash.sh`
4. Then `git commit` — the pre-commit hook will find your proof and pass

## Checklist

### 1. CLI ↔ CLAUDE.md

Every command registered in `cli/commands/*.ts` (via `.command("name")`) must appear in the `## CLI` code block of `CLAUDE.md`. Check both directions:

- [ ] Every registered command has a `fleet <name>` line in CLAUDE.md (aliases like `ls` for `list` count)
- [ ] No stale commands in CLAUDE.md that were removed from the CLI
- [ ] New commands have accurate descriptions matching their `.description()` call

### 2. CLI ↔ Completions

Every registered command must appear in `completions/fleet.zsh` in the `commands=(...)` array.

- [ ] Every registered command has a `'name:Description'` entry
- [ ] Aliases (`.alias()`) have their own entries too
- [ ] Commands with subcommands/arguments have completion handlers in the `case` block
- [ ] No stale commands in completions that were removed from the CLI

### 3. CLI ↔ Tests

Every registered command must appear in `cli/tests/help-format.test.ts` `ALL_COMMANDS` array.

- [ ] ALL_COMMANDS contains every registered primary command name
- [ ] The "contains all N commands" test description matches the actual count
- [ ] `cli/tests/commands-smoke.test.ts` has `--help` tests for write commands
- [ ] No stale commands in test arrays that were removed from the CLI

### 4. Key Files Table

The `## Key files` table in CLAUDE.md should reference important new files.

- [ ] New command files mentioned if they introduce significant functionality
- [ ] New scripts mentioned if they're part of the workflow

### 5. Cross-references

- [ ] `~/.claude/fleet.md` symlink resolves to the same CLAUDE.md that was updated
- [ ] If MCP tools changed, the MCP tools table in CLAUDE.md is current

## Proof XML Format

After verifying, write to the path from `bash scripts/verification-hash.sh`:

```xml
<verification>
  <timestamp>ISO-8601</timestamp>
  <staged_hash>the hash from verification-hash.sh</staged_hash>
  <checks>
    <check name="cli-claudemd" status="pass|fail|skip" note="optional detail" />
    <check name="cli-completions" status="pass|fail|skip" note="optional detail" />
    <check name="cli-tests" status="pass|fail|skip" note="optional detail" />
    <check name="key-files" status="pass|fail|skip" note="optional detail" />
    <check name="cross-refs" status="pass|fail|skip" note="optional detail" />
  </checks>
  <summary>1-2 sentence overall assessment</summary>
</verification>
```

All checks must be `pass` or `skip` (with justification) for the commit to proceed.
