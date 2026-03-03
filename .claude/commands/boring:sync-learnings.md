---
description: "Sync harness learnings from current project back to boring (upstream)"
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

# Sync Harness Learnings to Upstream (boring)

You are syncing improvements made in the current project's harness back to the upstream `boring` repo at `/Users/wz/repos/boring` (also `~/.claude-ops`, `~/.boring`).

## Context

The boring repo is the **upstream template** for all Claude agent infrastructure — watchdog, worker scripts, hooks, bus, templates. Individual projects (like Wechat) evolve these files through daily use. This command syncs those learnings back upstream so future projects benefit.

## Steps

### 1. Discover what's changed

Run these in parallel:

```bash
# Modified files in boring repo (direct edits via symlinks)
git -C /Users/wz/repos/boring diff --stat

# Project-specific scripts that diverged from boring copies
for f in .claude/scripts/*.sh; do
  [ -L "$f" ] && continue  # skip symlinks (already in boring)
  base=$(basename "$f")
  boring="/Users/wz/repos/boring/scripts/$base"
  [ -f "$boring" ] && ! diff -q "$f" "$boring" >/dev/null 2>&1 && echo "DIVERGED: $base"
done

# New files in boring not yet tracked
git -C /Users/wz/repos/boring status --short | grep '^??'
```

### 2. Categorize changes

For each changed file, determine:

| Category | Action |
|----------|--------|
| **Bug fix** (watchdog, detection logic, zsh compat) | Sync to boring immediately |
| **New feature** (register-pane.sh, border indicators) | Copy to boring/scripts or boring/templates |
| **Project-specific** (seed scripts, mission files) | Do NOT sync — these are Wechat-specific |
| **Template improvement** (worker state.json, permissions patterns) | Update boring/templates/ |
| **New reusable pattern** (PERPETUAL-PROTOCOL.md) | Copy to boring/templates/flat-worker/ |

### 3. Sync files

For each file to sync:
- If it's a symlinked file (already in boring): changes are already there, just needs commit
- If it diverged from boring copy: diff the two, merge improvements
- If it's new and reusable: copy to appropriate boring directory

### 4. Review and present

Show Warren a summary table:

| File | Change | Category | Synced? |
|------|--------|----------|---------|
| scripts/harness-watchdog.sh | TUI detection fix, full seed injection | Bug fix | ✓ already in boring |
| scripts/register-pane.sh | New self-registration | New feature | → boring/scripts/ |
| ... | ... | ... | ... |

### 5. Commit to boring

```bash
cd /Users/wz/repos/boring
git add -A  # or specific files
git commit -m "sync(harness): learnings from Wechat project

- [list key improvements]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

## Key files to check

**Scripts (boring/scripts/):**
- `harness-watchdog.sh` — watchdog detection, respawn logic, seed injection
- `check-flat-workers.sh` — fleet status display
- `launch-flat-worker.sh` — worker launch with registration
- `worker-commit.sh` — worker git commit helper
- `pre-compact.sh` — context compaction

**Hooks (boring/hooks/):**
- `gates/stop-session.sh` — stop hook checklist
- `gates/tool-policy-gate.sh` — tool permission enforcement
- `publishers/post-tool-publisher.sh` — bus event publishing
- `interceptors/pre-tool-context-injector.sh` — context injection

**Templates (boring/templates/flat-worker/):**
- `state.json` — worker state template
- New: `PERPETUAL-PROTOCOL.md` if it should be a default template

**Bus (boring/bus/):**
- `schema.json` — event bus schema
- `side-effects/` — bus event handlers

## Rules

- NEVER sync project-specific content (mission files, seed scripts with project names, credentials)
- ALWAYS preserve backward compatibility — other projects use boring too
- If a boring file was modified for project-specific reasons, extract the reusable part
- Present the diff summary to Warren before committing
