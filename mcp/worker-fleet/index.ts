#!/usr/bin/env bun
/**
 * worker-fleet MCP server — Provides Claude tools for worker fleet coordination.
 *
 * Wraps existing shell scripts (worker-message.sh, worker-task.sh, worker-commit.sh,
 * check-flat-workers.sh) and adds native TS for simple file reads.
 *
 * Runtime: bun run ~/.claude-ops/mcp/worker-fleet/index.ts (stdio transport)
 * Identity: auto-detected from WORKER_NAME env, git branch, or fallback "operator"
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";
import { execSync, spawnSync } from "child_process";

// ── Configuration ────────────────────────────────────────────────────
const PROJECT_ROOT = process.env.PROJECT_ROOT || "/Users/wz/Desktop/zPersonalProjects/Wechat";
const CLAUDE_OPS = process.env.CLAUDE_OPS_DIR || join(process.env.HOME!, ".claude-ops");
const WORKERS_DIR = join(PROJECT_ROOT, ".claude/workers");
// Available for future use
// const PANE_REGISTRY = join(CLAUDE_OPS, "state/pane-registry.json");
// const BUS_SCHEMA = join(PROJECT_ROOT, ".claude/bus/schema.json");

// Script paths
const WORKER_MESSAGE_SH = join(CLAUDE_OPS, "scripts/worker-message.sh");
const WORKER_TASK_SH = join(CLAUDE_OPS, "scripts/worker-task.sh");
const WORKER_COMMIT_SH = join(PROJECT_ROOT, ".claude/scripts/worker-commit.sh");
const CHECK_WORKERS_SH = join(CLAUDE_OPS, "scripts/check-flat-workers.sh");
const REQUEST_MERGE_SH = join(PROJECT_ROOT, ".claude/scripts/request-merge.sh");

// ── Worker Identity Detection ────────────────────────────────────────
function detectWorkerName(): string {
  // 1. Env var
  if (process.env.WORKER_NAME) return process.env.WORKER_NAME;

  // 2. Git branch
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: process.cwd(),
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    if (branch.startsWith("worker/")) return branch.slice("worker/".length);
  } catch {}

  // 3. Fallback
  return "operator";
}

const WORKER_NAME = detectWorkerName();

// ── Helpers ──────────────────────────────────────────────────────────

function runScript(
  cmd: string,
  args: string[],
  opts: { cwd?: string; timeout?: number } = {}
): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync("bash", [cmd, ...args], {
    cwd: opts.cwd || PROJECT_ROOT,
    encoding: "utf-8",
    timeout: opts.timeout || 30_000,
    env: { ...process.env, PROJECT_ROOT },
  });
  return {
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    exitCode: result.status ?? 1,
  };
}

function readJsonFile(path: string): any {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function readJsonlFile(path: string, limit?: number, since?: string): any[] {
  try {
    const lines = readFileSync(path, "utf-8").split("\n").filter(Boolean);
    let entries = lines.map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);

    if (since) {
      entries = entries.filter((e) => {
        const ts = e._ts || e.ts || e.timestamp || "";
        return ts >= since;
      });
    }

    if (limit && limit > 0) {
      entries = entries.slice(-limit);
    }

    return entries;
  } catch {
    return [];
  }
}

/** mkdir-based spinlock matching harness-jq.sh convention */
function acquireLock(lockPath: string, maxWaitMs = 10_000): boolean {
  const start = Date.now();
  while (true) {
    try {
      mkdirSync(lockPath, { recursive: false });
      return true;
    } catch {
      if (Date.now() - start > maxWaitMs) {
        // Force break stale lock
        try { execSync(`rm -rf "${lockPath}"`, { timeout: 2000 }); } catch {}
        try { mkdirSync(lockPath, { recursive: false }); return true; } catch {}
        return false;
      }
      execSync("sleep 0.1", { timeout: 1000 });
    }
  }
}

function releaseLock(lockPath: string) {
  try { execSync(`rm -rf "${lockPath}"`, { timeout: 2000 }); } catch {}
}

// ── MCP Server ───────────────────────────────────────────────────────

const server = new McpServer({
  name: "worker-fleet",
  version: "1.0.0",
});

// ═══════════════════════════════════════════════════════════════════
// MESSAGING TOOLS (4)
// ═══════════════════════════════════════════════════════════════════

server.tool(
  "send_message",
  "Send a direct message to a specific worker (durable inbox + tmux instant delivery)",
  {
    to: z.string().describe("Worker name (e.g. 'chief-of-staff', 'chatbot-tools')"),
    content: z.string().describe("Message content"),
    summary: z.string().optional().describe("Short preview (5-10 words)"),
  },
  async ({ to, content, summary }) => {
    try {
      const args = ["send", to, content];
      if (summary) args.push("--summary", summary);
      const result = runScript(WORKER_MESSAGE_SH, args);
      if (result.exitCode !== 0) {
        return { content: [{ type: "text", text: `Error: ${result.stderr || result.stdout}` }], isError: true };
      }
      return { content: [{ type: "text", text: result.stdout }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "broadcast",
  "Send a message to all workers (use sparingly — costs scale with team size)",
  {
    content: z.string().describe("Message content"),
    summary: z.string().optional().describe("Short preview (5-10 words)"),
  },
  async ({ content, summary }) => {
    try {
      const args = ["broadcast", content];
      if (summary) args.push("--summary", summary);
      const result = runScript(WORKER_MESSAGE_SH, args);
      if (result.exitCode !== 0) {
        return { content: [{ type: "text", text: `Error: ${result.stderr || result.stdout}` }], isError: true };
      }
      return { content: [{ type: "text", text: result.stdout }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "read_inbox",
  "Read your inbox messages (durable messages from other workers)",
  {
    limit: z.number().optional().describe("Max messages to return (default: all)"),
    since: z.string().optional().describe("ISO timestamp — only messages after this time"),
  },
  async ({ limit, since }) => {
    try {
      const inboxPath = join(WORKERS_DIR, WORKER_NAME, "inbox.jsonl");
      if (!existsSync(inboxPath)) {
        return { content: [{ type: "text", text: "Inbox empty (file does not exist)" }] };
      }
      const messages = readJsonlFile(inboxPath, limit, since);
      if (messages.length === 0) {
        return { content: [{ type: "text", text: "Inbox empty" }] };
      }
      const formatted = messages.map((m) => {
        const from = m.from_name || m.from || "?";
        const type = m.msg_type || "message";
        const text = m.content || m.message || "";
        const ts = m._ts || m.ts || "";
        return `[${type}] from ${from}${ts ? ` at ${ts}` : ""}: ${text}`;
      }).join("\n");
      return { content: [{ type: "text", text: `${messages.length} messages:\n${formatted}` }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "clear_inbox",
  "Mark all inbox messages as read (truncates inbox.jsonl)",
  {},
  async () => {
    try {
      const inboxPath = join(WORKERS_DIR, WORKER_NAME, "inbox.jsonl");
      if (existsSync(inboxPath)) {
        writeFileSync(inboxPath, "");
      }
      return { content: [{ type: "text", text: "Inbox cleared" }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// TASK TOOLS (5)
// ═══════════════════════════════════════════════════════════════════

server.tool(
  "create_task",
  "Create a new task in your worker's task list",
  {
    subject: z.string().describe("Task title (imperative form)"),
    description: z.string().optional().describe("Detailed description"),
    priority: z.enum(["critical", "high", "medium", "low"]).optional().describe("Priority level (default: medium)"),
    active_form: z.string().optional().describe("Present continuous label for spinner (e.g. 'Running tests')"),
    blocks: z.string().optional().describe("Comma-separated task IDs this task blocks (e.g. 'T003,T004')"),
    blocked_by: z.string().optional().describe("Comma-separated task IDs that block this (e.g. 'T001,T002')"),
    recurring: z.boolean().optional().describe("If true, resets to pending when completed"),
  },
  async ({ subject, description, priority, active_form, blocks, blocked_by, recurring }) => {
    try {
      const args = ["add", subject];
      if (priority) args.push("--priority", priority);
      if (description) args.push("--desc", description);
      if (active_form) args.push("--active", active_form);
      if (blocks) args.push("--blocks", blocks);
      if (blocked_by) args.push("--after", blocked_by);
      if (recurring) args.push("--recurring");
      const result = runScript(WORKER_TASK_SH, args);
      if (result.exitCode !== 0) {
        return { content: [{ type: "text", text: `Error: ${result.stderr || result.stdout}` }], isError: true };
      }
      return { content: [{ type: "text", text: result.stdout }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "claim_task",
  "Claim a task (assign it to yourself and set status to in_progress)",
  {
    task_id: z.string().describe("Task ID (e.g. 'T001')"),
  },
  async ({ task_id }) => {
    try {
      const result = runScript(WORKER_TASK_SH, ["claim", task_id]);
      if (result.exitCode !== 0) {
        return { content: [{ type: "text", text: `Error: ${result.stderr || result.stdout}` }], isError: true };
      }
      return { content: [{ type: "text", text: result.stdout }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "complete_task",
  "Mark a task as completed (recurring tasks auto-reset to pending)",
  {
    task_id: z.string().describe("Task ID (e.g. 'T001')"),
  },
  async ({ task_id }) => {
    try {
      const result = runScript(WORKER_TASK_SH, ["complete", task_id]);
      if (result.exitCode !== 0) {
        return { content: [{ type: "text", text: `Error: ${result.stderr || result.stdout}` }], isError: true };
      }
      return { content: [{ type: "text", text: result.stdout }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "list_tasks",
  "List tasks across workers — unified cross-worker view or filtered to one worker",
  {
    filter: z.enum(["all", "pending", "in_progress", "blocked"]).optional().describe("Filter by status (default: all non-deleted)"),
    worker: z.string().optional().describe("Specific worker name, or 'all' for cross-worker view (default: self)"),
  },
  async ({ filter, worker }) => {
    try {
      const targetWorkers: string[] = [];
      const workerName = worker || WORKER_NAME;

      if (workerName === "all") {
        // Cross-worker: read all tasks.json files
        const dirs = readdirSync(WORKERS_DIR, { withFileTypes: true })
          .filter((d) => d.isDirectory() && !d.name.startsWith(".") && !d.name.startsWith("_"))
          .map((d) => d.name);
        targetWorkers.push(...dirs);
      } else {
        targetWorkers.push(workerName);
      }

      const results: string[] = [];
      let totalCount = 0;

      for (const w of targetWorkers) {
        const tasksPath = join(WORKERS_DIR, w, "tasks.json");
        const tasks = readJsonFile(tasksPath);
        if (!tasks || Object.keys(tasks).length === 0) continue;

        const entries = Object.entries(tasks) as [string, any][];
        const filtered = entries.filter(([, t]) => {
          if (t.status === "deleted") return false;

          // Compute blocked status
          const deps: string[] = t.blocked_by || [];
          const isBlocked = deps.length > 0 && deps.some((d: string) => tasks[d]?.status !== "completed");

          if (filter === "pending") return t.status === "pending" && !isBlocked;
          if (filter === "in_progress") return t.status === "in_progress";
          if (filter === "blocked") return isBlocked && t.status !== "completed";
          return true; // "all" — non-deleted
        });

        if (filtered.length === 0) continue;

        results.push(`## ${w}`);
        for (const [id, t] of filtered) {
          const deps: string[] = t.blocked_by || [];
          const isBlocked = deps.length > 0 && deps.some((d: string) => tasks[d]?.status !== "completed");
          const status = isBlocked ? "blocked" : t.status;
          const depsStr = deps.length > 0 ? ` [after:${deps.join(",")}]` : "";
          const recStr = t.recurring ? " (recurring)" : "";
          results.push(`  ${id} [${t.priority || "medium"}] ${status}: ${t.subject}${depsStr}${recStr}`);
          totalCount++;
        }
      }

      if (results.length === 0) {
        return { content: [{ type: "text", text: "No tasks found" }] };
      }

      return { content: [{ type: "text", text: `${totalCount} tasks:\n${results.join("\n")}` }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "my_tasks",
  "List your own tasks (shortcut for list_tasks with your worker name)",
  {},
  async () => {
    try {
      const result = runScript(WORKER_TASK_SH, ["list"]);
      if (result.exitCode !== 0) {
        return { content: [{ type: "text", text: `Error: ${result.stderr || result.stdout}` }], isError: true };
      }
      return { content: [{ type: "text", text: result.stdout || "No tasks" }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// STATE TOOLS (3)
// ═══════════════════════════════════════════════════════════════════

server.tool(
  "get_worker_state",
  "Read a worker's state.json (default: your own)",
  {
    name: z.string().optional().describe("Worker name (default: self)"),
  },
  async ({ name }) => {
    try {
      const targetName = name || WORKER_NAME;
      const statePath = join(WORKERS_DIR, targetName, "state.json");
      if (!existsSync(statePath)) {
        return { content: [{ type: "text", text: `No state.json for worker '${targetName}'` }], isError: true };
      }
      const state = readJsonFile(statePath);
      return { content: [{ type: "text", text: JSON.stringify(state, null, 2) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "update_state",
  "Update a key in your own state.json and emit a bus event",
  {
    key: z.string().describe("State key to update (e.g. 'status', 'cycles_completed')"),
    value: z.union([z.string(), z.number(), z.boolean()]).describe("New value"),
  },
  async ({ key, value }) => {
    try {
      const statePath = join(WORKERS_DIR, WORKER_NAME, "state.json");
      const lockPath = statePath + ".lock";

      if (!existsSync(statePath)) {
        return { content: [{ type: "text", text: `No state.json for worker '${WORKER_NAME}'` }], isError: true };
      }

      acquireLock(lockPath);
      try {
        const state = readJsonFile(statePath) || {};
        state[key] = value;
        writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
      } finally {
        releaseLock(lockPath);
      }

      // Emit bus event (best-effort)
      try {
        const payload = JSON.stringify({
          worker: WORKER_NAME,
          key,
          value,
          channel: "worker-fleet-mcp",
        });
        execSync(
          `source "${CLAUDE_OPS}/lib/event-bus.sh" && bus_publish "agent.state-changed" '${payload.replace(/'/g, "'\\''")}'`,
          { cwd: PROJECT_ROOT, timeout: 5000, encoding: "utf-8", shell: "/bin/bash" }
        );
      } catch {}

      return { content: [{ type: "text", text: `Updated state.${key} = ${JSON.stringify(value)}` }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "fleet_status",
  "Get full fleet status (same output as check-flat-workers.sh)",
  {},
  async () => {
    try {
      const result = runScript(CHECK_WORKERS_SH, ["--project", PROJECT_ROOT], { timeout: 15_000 });
      if (result.exitCode !== 0) {
        return { content: [{ type: "text", text: `Error: ${result.stderr || result.stdout}` }], isError: true };
      }
      return { content: [{ type: "text", text: result.stdout }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// GIT TOOLS (2)
// ═══════════════════════════════════════════════════════════════════

server.tool(
  "smart_commit",
  "Commit staged changes with structured metadata + optional merge request signal",
  {
    message: z.string().describe("Commit message in type(scope): description format"),
    files: z.string().optional().describe("Space-separated files to git add before committing"),
    verified_test: z.boolean().optional().describe("Skip test run (pre-verified)"),
    verified_tsc: z.boolean().optional().describe("Skip tsc check (pre-verified)"),
    merge_request: z.boolean().optional().describe("Signal chief-of-staff to merge after commit"),
    service_hint: z.string().optional().describe("Deploy service hint for merge (static|web|core)"),
  },
  async ({ message, files, verified_test, verified_tsc, merge_request, service_hint }) => {
    try {
      const args = [message];
      if (files) args.push("--add", files);
      if (verified_test) args.push("--verified-test");
      if (verified_tsc) args.push("--verified-tsc");

      const result = runScript(WORKER_COMMIT_SH, args, { timeout: 60_000 });
      let output = result.stdout;

      if (result.exitCode !== 0) {
        return { content: [{ type: "text", text: `Commit failed: ${result.stderr || result.stdout}` }], isError: true };
      }

      // Handle merge request signal
      if (merge_request && existsSync(REQUEST_MERGE_SH)) {
        const mrArgs: string[] = [];
        if (service_hint) mrArgs.push("--service", service_hint);
        const mrResult = runScript(REQUEST_MERGE_SH, mrArgs);
        output += "\n" + (mrResult.stdout || mrResult.stderr);
      }

      return { content: [{ type: "text", text: output }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "merge_request",
  "Signal chief-of-staff that your branch is ready to merge into main",
  {
    description: z.string().optional().describe("Summary of changes for chief-of-staff"),
    service_hint: z.enum(["static", "web", "core"]).optional().describe("Recommended deploy service type"),
  },
  async ({ description, service_hint }) => {
    try {
      if (!existsSync(REQUEST_MERGE_SH)) {
        return { content: [{ type: "text", text: "Error: request-merge.sh not found" }], isError: true };
      }

      const args: string[] = [];
      if (service_hint) args.push("--service", service_hint);
      if (description) args.push("--desc", description);

      const result = runScript(REQUEST_MERGE_SH, args);
      if (result.exitCode !== 0) {
        return { content: [{ type: "text", text: `Error: ${result.stderr || result.stdout}` }], isError: true };
      }
      return { content: [{ type: "text", text: result.stdout }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// NEXUS TOOL (1)
// ═══════════════════════════════════════════════════════════════════

server.tool(
  "post_to_nexus",
  "Post a status message to a Nexus room with [worker-name] prefix",
  {
    message: z.string().describe("Message content"),
    room: z.string().optional().describe("Nexus room (default: nexus-qbg-zhu)"),
  },
  async ({ message, room }) => {
    try {
      const targetRoom = room || "nexus-qbg-zhu";
      const prefixedMessage = `[${WORKER_NAME}] ${message}`;

      // Use the Nexus MCP server's Matrix HTTP API via curl
      // Read credentials from ~/.nexus-config or env
      const nexusConfig = join(process.env.HOME!, ".nexus-config");
      let accessToken = process.env.NEXUS_ACCESS_TOKEN || "";
      let homeserver = process.env.NEXUS_HOMESERVER || "https://footemp.bar";

      if (!accessToken && existsSync(nexusConfig)) {
        try {
          const config = readJsonFile(nexusConfig);
          accessToken = config?.access_token || config?.accessToken || "";
          homeserver = config?.homeserver || homeserver;
        } catch {}
      }

      if (!accessToken) {
        // Fallback: use the Nexus MCP tool via shell
        // This matches the nexus-messaging skill pattern
        return {
          content: [{
            type: "text",
            text: `Nexus token not configured. Message not sent.\nIntended: [${WORKER_NAME}] ${message} → ${targetRoom}`,
          }],
          isError: true,
        };
      }

      // Matrix send message API
      const txnId = `m${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
      const roomAlias = targetRoom.startsWith("#") ? targetRoom : `#${targetRoom}:footemp.bar`;

      // Resolve room alias to room ID
      const resolveResult = spawnSync("curl", [
        "-sf",
        "-H", `Authorization: Bearer ${accessToken}`,
        `${homeserver}/_matrix/client/v3/directory/room/${encodeURIComponent(roomAlias)}`,
      ], { encoding: "utf-8", timeout: 10_000 });

      let roomId: string;
      try {
        roomId = JSON.parse(resolveResult.stdout).room_id;
      } catch {
        return { content: [{ type: "text", text: `Failed to resolve room '${targetRoom}'` }], isError: true };
      }

      // Send message
      const sendResult = spawnSync("curl", [
        "-sf",
        "-X", "PUT",
        "-H", `Authorization: Bearer ${accessToken}`,
        "-H", "Content-Type: application/json",
        "-d", JSON.stringify({ msgtype: "m.text", body: prefixedMessage }),
        `${homeserver}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`,
      ], { encoding: "utf-8", timeout: 10_000 });

      if (sendResult.status !== 0) {
        return { content: [{ type: "text", text: `Failed to send to Nexus: ${sendResult.stderr}` }], isError: true };
      }

      return { content: [{ type: "text", text: `Posted to ${targetRoom}: [${WORKER_NAME}] ${message}` }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════════

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error("worker-fleet MCP server fatal:", e);
  process.exit(1);
});
