/**
 * Guard Rails Program — demonstrates per-agent hooks for different permission levels.
 *
 * 1 phase with 3 agents:
 *   - reader: PreToolUse hook blocking Edit|Write|Bash (read-only analyst)
 *   - writer: PreToolUse hook on Bash with prompt type (safety check before shell commands)
 *   - coordinator: no hooks (full access)
 *
 * Demonstrates:
 *   - agent.hooks (per-agent hook installation)
 *   - PipelineHook with matcher (regex for tool names)
 *   - PipelineHook type:"prompt" (inject safety context)
 *   - Mixed permission levels within the same phase
 *
 * Usage:
 *   fleet pipeline guard-rails --spec "analyze the authentication module"
 *   fleet pipeline guard-rails --dry-run
 */
import type { Program } from "../engine/program/types";

export interface GuardRailsOpts {
  spec?: string;
  projectRoot?: string;
  scope?: string;
  force?: boolean;
}

export default function guardRails(opts: GuardRailsOpts): Program {
  const spec = opts.spec || "Analyze the codebase and identify areas for improvement.";

  return {
    name: "guard-rails",
    description: "Per-agent hooks demo: reader (read-only), writer (guarded), coordinator (full)",
    phases: [
      {
        name: "analysis",
        description: "Three agents with different permission levels analyze the codebase",
        agents: [
          // ── Reader: read-only analyst ──────────────────────
          {
            name: "reader",
            role: "analyst",
            model: "sonnet",
            seed: { inline: readerSeed(spec) },
            window: "analysis",
            hooks: [
              {
                event: "PreToolUse",
                type: "command",
                description: "Block write operations (read-only agent)",
                matcher: "Edit|Write|Bash|NotebookEdit",
                command: `#!/usr/bin/env bash
echo "BLOCKED: reader agent is read-only. Use Read, Glob, Grep, Agent tools only." >&2
exit 1`,
                blocking: true,
              },
            ],
          },

          // ── Writer: guarded shell access ───────────────────
          {
            name: "writer",
            role: "implementer",
            model: "sonnet",
            seed: { inline: writerSeed(spec) },
            window: "analysis",
            hooks: [
              {
                event: "PreToolUse",
                type: "prompt",
                description: "Safety check before shell commands",
                matcher: "Bash",
                prompt: `SAFETY CHECK: You are about to run a shell command. Before proceeding:
1. Verify this command is non-destructive (no rm -rf, git reset --hard, etc.)
2. Verify it does not modify files outside the project directory
3. Verify it does not send data to external services
4. Verify it does not install global packages
If any check fails, use a safer alternative or skip the command.`,
                blocking: false,
              },
            ],
          },

          // ── Coordinator: full access ───────────────────────
          {
            name: "coordinator",
            role: "coordinator",
            model: "opus",
            seed: { inline: coordinatorSeed(spec) },
            window: "coordinator",
          },
        ],
        gate: "coordinator",
        layout: { panesPerWindow: 3, algorithm: "tiled" },
      },
    ],
    defaults: {
      model: "sonnet",
      effort: "high",
      permission: "bypassPermissions",
    },
    material: {
      scope: opts.scope,
      spec,
    },
  };
}

function readerSeed(spec: string): string {
  return `You are a read-only code analyst.

## Constraint
You have READ-ONLY access. You cannot edit files, write files, or run shell commands.
You can only use: Read, Glob, Grep, and Agent tools.

## Task
${spec}

Analyze the codebase thoroughly. For each issue or improvement opportunity you find:
1. Document the file path and line numbers
2. Explain the issue clearly
3. Suggest a fix (but you cannot apply it yourself)

Write your findings to stdout. The coordinator will collect your analysis.
Focus on: architecture, patterns, potential bugs, security issues, and code quality.`;
}

function writerSeed(spec: string): string {
  return `You are a guarded code implementer.

## Constraint
You can read and write files, but shell commands go through a safety check.
Destructive operations will be flagged. Prefer safe, reversible changes.

## Task
${spec}

Based on any analysis from other agents in the session directory:
1. Implement the most impactful improvements
2. Make small, focused changes (one concern per edit)
3. Verify each change compiles correctly
4. Document what you changed and why

Write a summary of your changes to {{SESSION_DIR}}/writer-changes.md.`;
}

function coordinatorSeed(spec: string): string {
  return `You are the coordinator with full access.

## Task
${spec}

You coordinate between the reader (read-only analyst) and writer (guarded implementer).

Your workflow:
1. Wait for both agents to complete their work
2. Read the reader's analysis from their session output
3. Read the writer's changes from {{SESSION_DIR}}/writer-changes.md
4. Verify the writer's changes address the reader's findings
5. Run any necessary verification (tests, builds)
6. Write a final report to {{SESSION_DIR}}/report.md with:
   - Issues found by reader
   - Changes made by writer
   - Verification results
   - Remaining open items`;
}
