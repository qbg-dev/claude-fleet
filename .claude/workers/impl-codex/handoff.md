## Codex Runtime Integration — Complete

### Shipped
- `fleet create --runtime codex` now provisions full codex worker infrastructure:
  - `.codex/config.toml` with worker-fleet MCP (`[[mcp_servers]]` entry + FLEET_MAIL_URL)
  - Trust entry in `~/.codex/config.toml` for the worktree path
  - `AGENTS.md` with mission + fleet identity + git safety rules + workflow
  - `.codex/hooks/git-safety-gate.sh` for when codex adds hook API
- CODEX_RUNTIME: `workspace-write` → `danger-full-access`, `--add-dir` added
- `launch.ts` + `config.ts` generateLaunchSh: codex-specific launch commands
- `shared/types.ts`: `runtime?: "claude" | "codex"` on WorkerConfig
- `registry.ts`: reads `config.runtime` instead of hardcoding `"claude"`
- `fleet ls`: RUNTIME column added
- `templates/codex-seed-context.md` + `scripts/codex-git-safety-hook.sh` (tracked)

### 三省吾身
1. **为人谋而不忠乎**: Shipped all 6 acceptance criteria. No blockers.
2. **与朋友交而不信乎**: Build verified end-to-end (bun build 337 modules). Codex hooks limitation documented honestly—no hook API in v0.111.0.
3. **传不习乎**: Key pattern: codex reads project config from `.codex/config.toml` in worktree; trust must be explicitly added to `~/.codex/config.toml`; AGENTS.md is the primary instruction injection path (not symlinked CLAUDE.md).

### Remaining / Next Round
- None from mission. Pending merger to cherry-pick a8bafa0 + c9958ec to main.
- Future: when codex exposes hooks in config.toml, wire `install-codex-hooks.sh` into the `[hooks.pre_tool_use]` registration.
