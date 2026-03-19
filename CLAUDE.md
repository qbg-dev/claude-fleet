# claude-fleet

Every Claude Code session is automatically part of the fleet. Identity = Fleet Mail name, derived from session ID.

## Identity

On first prompt, a global hook auto-registers you with Fleet Mail **and** creates a worker entry:
- **Mail name**: `{custom-name}-{dir-slug}-{session-id}`
- **Three-part identity**: mail-name + session + tmux-pane. Without a pane = assumed dead.
- **Unified identity**: `fleet register` creates both `.sessions/{sid}/` and `~/.claude/fleet/{project}/{name}/` entries.
- **Session file** is the primary object. Transcripts sync to Fleet Mail every 5 minutes.
- Auto-registered sessions are marked `ephemeral: true` (watchdog skips them).
- Check yours: `fleet session info`

Multiple agents in same directory get unique mail names. Rename: `fleet register --name <name>`.

## Communication

All fleet communication via CLI (Bash tool). No MCP tools for fleet ops.

```
fleet mail send <to> "<subject>" "<body>"   # send message
fleet mail inbox [--label UNREAD]           # read inbox
fleet mail read <id>                        # read by ID
fleet mail help                             # API reference
```

Recipient resolution: substring match, full mail name, or `list:<name>` for mailing lists.

## State & Lifecycle

```
fleet state get [key]                       # read state
fleet state set <key> <value>               # persist across recycles
fleet checkpoint "<summary>"                # crash-recovery snapshot
fleet register [--name <n>]                 # re-register/rename
fleet session ls                            # list live sessions
fleet session sync                          # force transcript sync
```

## Hooks

Two kinds: **static** (always-on, from `fleet setup`) and **dynamic** (registered at runtime).

### Static hooks (47 hooks, 22 events)
Key ones: **UserPromptSubmit** (auto-registration, sync, heartbeat), **PreCompact** (re-injects seed+mission), **Stop** (inbox drain, unpushed check, task verify).

### Dynamic hooks

```
mcp__claude-hooks__add_hook(event, description, ...)  # register
mcp__claude-hooks__complete_hook(id)                   # unblock gate
mcp__claude-hooks__list_hooks()                        # see active
mcp__claude-hooks__remove_hook(id)                     # archive
```
CLI: `fleet hook add|rm|ls|complete`

### Hook types

| Type | How | Use case |
|------|-----|----------|
| **inject** | `content` field, `blocking: false` | Add context before tool calls/compaction |
| **gate** | `blocking: true` | Block until `complete_hook(id)` or `check` passes |
| **check** | `check` field (bash) | Auto-evaluated gate—exit 0=allow, non-zero=block |
| **script** | `script` field | Run bash on event. Exit 0=allow, 2=block, 1=error |

### Scoping

| Param | Scope | When |
|-------|-------|------|
| *(default)* | Current session | Self-governance |
| `global: true` | ALL sessions | Sparingly—fires everywhere incl. coordinator |
| `agent_id: "name"` | Specific subagent | NOT pipeline nodes (those are main agents) |

### Per-agent hooks in program specs

For pipelines, use `AgentSpec.hooks` (installed via `installPipelineHooks()`—scoped, no global pollution):
```typescript
hooks: [
  { event: "PreCompact", type: "prompt", prompt: "Re-read HARDENING-LEARNINGS.md..." },
  { event: "PreToolUse", type: "command", matcher: "Bash", blocking: true,
    check: 'echo "$TOOL_INPUT" | grep -qv "git push"' },
]
```
**Note**: Static PreCompact re-injects `mission.md`+`seed-context.md`, NOT program's seed prompt. Use per-agent PreCompact hooks to persist program-specific rules through compaction.

### Key events

| Event | When | Use |
|-------|------|-----|
| `PreToolUse` | Before tool call | Gate dangerous commands, inject reminders |
| `PostToolUse` | After tool call | Logging, notifications |
| `PreCompact` / `PostCompact` | Context compaction | Re-inject rules / verify+continue |
| `Stop` / `StopFailure` | Session end (normal/error) | Verify work, notifications |
| `SubagentStop` | Subagent finishes | Only subagents, NOT pipeline nodes |
| `UserPromptSubmit` | Prompt received | Auto-registration, sync |

### Lifetime

`cycle` (default): archived on recycle. `persistent`: survives recycles (default for Stop). `max_fires`: auto-passes after N blocks (default: 5).

## Orchestration

```
fleet create <name> "<mission>"    fleet start <name>         fleet stop <name> [--all]
fleet ls [--json]                  fleet status               fleet get <name>
fleet attach <name>                fleet recycle [name]       fleet log <name>
fleet fork <parent> <child> "<m>"  fleet nuke <name>
fleet send [text]                  # send text+Enter to tmux pane (default: self)
```

### `fleet send` — keystroke injection

Send text to any pane. Three modes (escalating aggression):
```bash
fleet send "/effort high"                            # queue (lands when idle)
fleet send --effort high -r 4 -d 2 -c "Resume."     # retry (4×, 2s apart)
fleet send --interrupt --effort max -c "Continue."   # interrupt (Ctrl+C + verify + continue)
fleet send -w solver "/compact"                      # target worker by name
fleet send --pane %33 "Check inbox."                 # target pane directly
echo "long prompt" | fleet send -w solver            # stdin pipe
```
Flags: `--effort <level>`, `--compact` (shorthands), `-w/--worker`, `-s/--session`, `--pane`, `-r/--repeat`, `-d/--delay`, `-c/--continue`, `-i/--interrupt`, `--no-enter`.

## Mission

Every session has `mission.md` (starts empty). Fill as you understand your task. Re-injected on compaction.

## Watchdog

launchd daemon (`com.tmux-agents.watchdog`), 30s poll. Respawns dead workers, kills stuck (10min), crash-loop protection (3/hr). Creates missing tmux windows automatically. Skips `ephemeral: true`. Perpetual workers: `round_stop()` → watchdog respawns after `sleep_duration`. Install: `bash extensions/watchdog/install.sh`

## Conventions

- Workers never push or merge—merger handles main
- tmux: never literal Enter (`send-keys -H 0d`), never `display-message -p '#{pane_id}'`
- Fleet Mail for all coordination (tasks = mail threads with TASK label)
- `fleet --help` for full CLI reference

## Agent Specs & `fleet run`

AgentSpec: YAML/JSON files describing an agent. Universal unit for CLI, programs, MCP, architect.

```
fleet run --spec solver.agent.yaml              # from spec
fleet run --prompt "Solve it" --name solver      # from flags
fleet run --prompt "Do X" --on-stop "fleet run --spec next.agent.yaml"  # chaining
fleet run --spec a.yaml --tool "submit:Submit:cmd=echo done:score=number"  # event tools
```

Key flags: `--spec`, `--prompt`, `--model`, `--runtime` (claude|sdk|codex|custom), `--effort`, `--permission`, `--hook "EVENT:CMD"`, `--on-stop`, `--tool`, `--env`, `--allowed-tools`, `--disallowed-tools`, `--system-prompt`, `--add-dir`, `--json-schema`, `--max-budget`.

Runtimes: `claude` (default, CLI in tmux), `sdk` (Agent SDK via bun), `codex` (OpenAI), `custom`.
Default models: `opus[1m]` (workers), `sonnet[1m]` (pipelines). `[1m]` = 1M context.

Event tools: custom MCP tools per agent. `mode: inline` (TS function) or `mode: command` (bash with `INPUT_*` env vars). Handler context: `sendMail()`, `updateState()`, `spawnWorker()`, `writeResult()`, `readResult()`.

## Infrastructure & Advanced

See `fleet --help` and `fleet <command> --help` for full reference. Key commands:
```
fleet setup [--extensions]    fleet doctor           fleet update [--reload]
fleet deploy <host> <url>     fleet pipeline <prog>  fleet deep-review <scope>
fleet tui [--account <n>]     fleet layout <cmd>     fleet launch
fleet hook <add|rm|ls|complete>
```
