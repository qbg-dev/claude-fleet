# boring — Agent Harness Infrastructure for Claude Code

[![Tests](https://github.com/qbg-dev/boring/actions/workflows/ci.yml/badge.svg)](https://github.com/qbg-dev/boring/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)

**boring** is an infrastructure layer built on top of Claude Code that turns Claude sessions into persistent, recoverable agents. It uses Claude Code's native hooks, settings, and session model—no separate runtime.

The design is simple: every agent is either a **coordinator** or a **worker**. Coordinators manage task graphs and delegate to workers. Workers claim tasks, execute them, and report back through an **event bus**. Every tool call flows through Claude Code hooks that log events, inject context, and keep agents on task. A **watchdog** respawns agents after graceful stops or crashes. You can interrupt at any point, steer the agent with a message, and it picks up where it left off.

## Quick Start

```bash
# 1. Install
curl -fsSL https://raw.githubusercontent.com/qbg-dev/boring/main/install.sh | bash

# 2. Scaffold a harness in your project
bash ~/.boring/scripts/scaffold.sh my-feature /path/to/project

# 3. Edit the task graph
$EDITOR /path/to/project/.claude/harness/my-feature/tasks.json

# 4. Generate a seed prompt and launch
bash /path/to/project/.claude/scripts/my-feature-seed.sh > /tmp/seed.txt
cat /tmp/seed.txt | claude --dangerously-skip-permissions --model claude-sonnet-4-6

# 5. Check status
bash ~/.boring/scripts/harness-watchdog.sh --status
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                          boring                             │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Harness    │    │  Event Bus   │    │     Hooks    │  │
│  │              │    │              │    │              │  │
│  │ tasks.json   │◄──►│ stream.jsonl │◄───│ PreToolUse   │  │
│  │ task graph   │    │ pub/sub      │    │ PostToolUse  │  │
│  │ lifecycle    │    │ side-effects │    │ Stop         │  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │
│         │                  │                   │           │
│  ┌──────▼───────┐    ┌──────▼───────────────────▼───────┐  │
│  │   Watchdog   │    │         Multi-Agent Layer        │  │
│  │              │    │                                  │  │
│  │ crash detect │    │  coordinator ──► worker-1        │  │
│  │ auto-respawn │    │       │        ► worker-2        │  │
│  │ stuck nudge  │    │  pane-registry, inbox/outbox     │  │
│  └──────────────┘    └──────────────────────────────────┘  │
│                                                             │
│  All state: {project}/.claude/  +  ~/.boring/state/         │
└─────────────────────────────────────────────────────────────┘
```

The **Stop hook** is the core mechanism: when Claude tries to stop, the hook checks the task graph. If tasks remain, it blocks the stop and shows the current state—the agent reads this and keeps working. When all tasks are done, it lets the session end. For long-running agents, it writes a sentinel and the watchdog respawns after a configurable sleep window.

The **PreToolUse hook** injects context at the moment of action—inbox messages from other agents, policy rules, phase state—so agents always have what they need without bloating the conversation.

## Human Steering

boring is designed for collaborative workflows where you stay in control:

- **Interrupt any time**: type in the tmux pane; the agent reads and adapts
- **Send a message**: `hq_send` delivers to the agent's inbox; PreToolUse injects it on the next tool call
- **Edit the task graph**: plain JSON—add, remove, or reprioritize tasks mid-session
- **Override the stop gate**: `touch ~/.boring/state/sessions/{id}/allow-stop`

## Directory Structure

```
~/.boring/
├── bin/                  # CLI tools (claude-mux, report-issue, ...)
├── bus/                  # Event bus state (stream.jsonl, schema.json, cursors/)
│   └── side-effects/     # Pluggable side-effect scripts
├── harness/
│   └── manifests/        # Per-harness registry (manifest.json)
├── hooks/
│   ├── dispatch/         # Stop hook modules
│   ├── gates/            # Stop gate + tool policy enforcement
│   ├── interceptors/     # PreToolUse context injection
│   ├── operators/        # PostToolUse checks (no-mock-data, etc.)
│   └── publishers/       # PostToolUse + prompt event publishers
├── lib/                  # Shared libraries (harness-jq.sh, event-bus.sh, ...)
├── scripts/              # CLI scripts (scaffold.sh, watchdog, monitor, ...)
├── sweeps.d/             # Cron-style maintenance sweeps
├── templates/            # Scaffold templates (.tmpl files)
├── tests/                # Test suite (163 tests, 10 suites)
└── wave-report-server/   # HTML report server for harness progress
```

## Manual Installation

```bash
git clone git@github.com:qbg-dev/boring.git ~/.boring
```

Add hooks to your Claude Code `settings.json` (`~/.claude/settings.json`):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash ~/.boring/hooks/interceptors/pre-tool-context-injector.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash ~/.boring/hooks/publishers/post-tool-publisher.sh"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash ~/.boring/hooks/gates/stop-harness-dispatch.sh"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash ~/.boring/hooks/publishers/prompt-publisher.sh"
          }
        ]
      }
    ]
  }
}
```

## Running Tests

```bash
bash ~/.boring/tests/run-all.sh
```

## Documentation

- [Getting Started](docs/getting-started.md) — install, scaffold first harness, launch first agent
- [Architecture](docs/architecture.md) — 5-component deep dive, data flow, file ownership
- [Event Bus](docs/event-bus.md) — `bus_publish` API, side-effects, schema reference
- [Hooks](docs/hooks.md) — hook pipeline, context injection, policy enforcement

## License

Apache 2.0 — see [LICENSE](LICENSE).
