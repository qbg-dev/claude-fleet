/**
 * Lifecycle tools — session_end, save_checkpoint
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { writeFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { HOME, WORKERS_DIR, WORKER_NAME, getWorktreeDir } from "../config";
import { readRegistry, withRegistryLocked, type RegistryConfig, type RegistryWorkerEntry } from "../registry";
import { dynamicHooks, _captureHooksSnapshot, _archiveHook, _persistHooks } from "../hooks";
import { _captureGitState, _writeCheckpoint } from "../helpers";
import { fleetMailRequest, resolveFleetMailRecipients, getFleetMailToken } from "../mail-client";

export function registerLifecycleTools(server: McpServer): void {

server.registerTool(
  "session_end",
  { description: `Mark a cycle boundary: save checkpoint, send cycle report, archive cycle-scoped hooks — but stay alive.

Use this when:
  - You finished a task and want to log progress before starting the next one
  - You're done with all work and want to save state before going idle
  - Context is getting long and you want a clean checkpoint

This does NOT exit your session or restart anything. You stay alive and keep working.
To actually restart a worker (fresh context, config reload), the operator runs \`fleet recycle <name>\` from the CLI.`, inputSchema: {
    message: z.string().optional().describe("Cycle summary: what was accomplished, what remains, any blockers. Written to handoff.md and checkpoint"),
  } },
  async ({ message }) => {
    // Save checkpoint
    try {
      const checkpointDir = join(WORKERS_DIR, WORKER_NAME, "checkpoints");
      const gitState = _captureGitState();
      const hooks = _captureHooksSnapshot();
      _writeCheckpoint(checkpointDir, {
        timestamp: new Date().toISOString(),
        type: "session-end" as const,
        summary: message || "Session end — cycle boundary",
        git_state: gitState,
        dynamic_hooks: hooks,
        key_facts: [] as string[],
        transcript_ref: "",
      });
    } catch {}

    // Update registry cycle marker
    withRegistryLocked((registry) => {
      const w = registry[WORKER_NAME] as RegistryWorkerEntry;
      if (w) {
        w.custom = w.custom || {};
        w.custom.last_cycle_at = new Date().toISOString();
      }
    });

    // Write handoff.md (for seed injection on next restart)
    if (message) {
      try {
        const handoffPath = join(WORKERS_DIR, WORKER_NAME, "handoff.md");
        writeFileSync(handoffPath, message.trim() + "\n");
      } catch {}
    }

    // Notify mission_authority (best-effort)
    try {
      const registry = readRegistry();
      const config = registry._config as RegistryConfig;
      const cycleReport = message
        ? `[${WORKER_NAME}] Cycle complete: ${message}`
        : `[${WORKER_NAME}] Cycle complete (no summary)`;
      const maList = config?.mission_authority;
      const operatorNames: string[] = !maList ? [] : Array.isArray(maList) ? maList : [maList];
      const filteredOps = operatorNames.filter(n => n !== WORKER_NAME);
      if (filteredOps.length > 0) {
        getFleetMailToken().then(async () => {
          const toIds = await resolveFleetMailRecipients(filteredOps);
          await fleetMailRequest("POST", "/api/messages/send", {
            to: toIds, subject: `${WORKER_NAME} cycle done`,
            body: cycleReport, cc: [], thread_id: null, in_reply_to: null,
            reply_by: null, labels: ["CYCLE-REPORT"], attachments: [],
          });
        }).catch(() => {});
      }
    } catch {}

    // Archive cycle-scoped hooks, keep persistent ones
    const archiveIds: string[] = [];
    for (const [id, hook] of dynamicHooks.entries()) {
      if (hook.lifetime !== "persistent") {
        archiveIds.push(id);
      }
    }
    for (const id of archiveIds) {
      _archiveHook(id, "cycle-end");
    }
    // Also archive completed persistent hooks (they did their job)
    for (const [id, hook] of dynamicHooks.entries()) {
      if (hook.completed) {
        _archiveHook(id, "completed");
      }
    }

    return {
      content: [{
        type: "text" as const,
        text: `Cycle logged, checkpoint saved. You are still alive.\n` +
          `${message ? `Handoff: "${message.slice(0, 120)}${message.length > 120 ? "..." : ""}"` : "No handoff message."}\n` +
          `Archived ${archiveIds.length} cycle-scoped hook(s). Persistent hooks survive.\n` +
          `Keep working — check mail_inbox() for new tasks, or go idle if nothing pending.`,
      }],
    };
  }
);

// ═══════════════════════════════════════════════════════════════════
// CHECKPOINT TOOLS (1) — save_checkpoint
// ═══════════════════════════════════════════════════════════════════

server.registerTool(
  "save_checkpoint",
  {
    description: "Save a checkpoint of your current working state. Automatically captures git state and dynamic hooks. Use before complex operations, when context is getting long, or to preserve state across restarts. Checkpoints are auto-saved on session_end and before context compaction.",
    inputSchema: {
      summary: z.string().describe("Brief description of what you're working on and current progress"),
      key_facts: z.array(z.string()).optional().describe("Important facts to preserve across context boundaries (max 10)"),
    },
  },
  async ({ summary, key_facts }) => {
    const checkpointDir = join(WORKERS_DIR, WORKER_NAME, "checkpoints");
    const gitState = _captureGitState();
    const hooks = _captureHooksSnapshot();

    // Get transcript reference
    let transcriptRef = "";
    try {
      const worktreeDir = getWorktreeDir();
      const pathSlug = worktreeDir.replace(/\//g, "-").replace(/^-/, "-");
      const projectDir = join(HOME, ".claude/projects", pathSlug);
      if (existsSync(projectDir)) {
        const files = readdirSync(projectDir).filter(f => f.endsWith(".jsonl")).sort().reverse();
        if (files.length > 0) {
          transcriptRef = join(projectDir, files[0]);
        }
      }
    } catch {}

    const checkpoint = {
      timestamp: new Date().toISOString(),
      type: "manual" as const,
      summary,
      git_state: gitState,
      dynamic_hooks: hooks,
      key_facts: (key_facts || []).slice(0, 10),
      transcript_ref: transcriptRef,
    };

    const filepath = _writeCheckpoint(checkpointDir, checkpoint);

    return {
      content: [{
        type: "text" as const,
        text: `Checkpoint saved: ${filepath}\nGit: ${gitState.branch || "?"} @ ${gitState.sha || "?"} (${gitState.dirty_count || 0} dirty, ${gitState.staged_count || 0} staged)\nHooks: ${hooks.length} active\nFacts: ${(key_facts || []).length} saved`,
      }],
    };
  }
);

} // end registerLifecycleTools
