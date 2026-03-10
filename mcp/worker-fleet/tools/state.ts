/**
 * State tools — get_worker_state, update_state, update_config, update_worker_config
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join, basename } from "path";
import { execSync } from "child_process";
import { PROJECT_ROOT, CLAUDE_OPS, WORKERS_DIR, FLEET_DIR, WORKER_NAME } from "../config";
import { getWorkerEntry, withRegistryLocked, ensureWorkerInRegistry, readFleetConfig, readWorkerConfig, writeWorkerConfig, writeLaunchScript, isMissionAuthority, getMissionAuthorityLabel, canUpdateWorker, type RegistryConfig, type RegistryWorkerEntry } from "../registry";
import { isPaneAlive } from "../tmux";
import { withLint } from "../diagnostics";

export function registerStateTools(server: McpServer): void {

server.registerTool(
  "get_worker_state",
  { description: "Read a worker's state from the central registry. Returns status, perpetual/sleep config, last commit info, issue counts, and any custom state keys. For a single worker, returns raw JSON. For name='all', returns a formatted fleet dashboard with a table of all workers showing runtime, status, pane health (alive/dead), and current in-progress task — plus a custom state section. The fleet view also auto-discovers workers from the filesystem and prunes dead panes.", inputSchema: {
    name: z.string().optional().describe("Worker name to query. Omit for your own state. Use 'all' for a fleet-wide dashboard showing every registered worker, pane health, and active tasks"),
  } },
  async ({ name }) => {
    try {
      // Fleet-wide overview
      if (name === "all") {
        // Cache pane liveness to avoid duplicate subprocess calls per worker
        const paneAliveCache = new Map<string, boolean>();
        const checkPaneAlive = (paneId: string): boolean => {
          const cached = paneAliveCache.get(paneId);
          if (cached !== undefined) return cached;
          const alive = isPaneAlive(paneId);
          paneAliveCache.set(paneId, alive);
          return alive;
        };

        const registry = withRegistryLocked((reg) => {
          // Auto-discover workers from per-worker fleet dirs (config.json) and legacy workers dir (mission.md)
          try {
            const fleetDirs = readdirSync(FLEET_DIR, { withFileTypes: true })
              .filter(d => d.isDirectory() && !d.name.startsWith(".") && !d.name.startsWith("_") && d.name !== "missions")
              .filter(d => existsSync(join(FLEET_DIR, d.name, "config.json")))
              .map(d => d.name);
            for (const n of fleetDirs) ensureWorkerInRegistry(reg, n);
          } catch {}
          try {
            const legacyDirs = readdirSync(WORKERS_DIR, { withFileTypes: true })
              .filter(d => d.isDirectory() && !d.name.startsWith(".") && !d.name.startsWith("_"))
              .filter(d => existsSync(join(WORKERS_DIR, d.name, "mission.md")))
              .map(d => d.name);
            for (const n of legacyDirs) ensureWorkerInRegistry(reg, n);
          } catch {}
          // Auto-prune dead panes
          for (const [key, entry] of Object.entries(reg)) {
            if (key === "_config" || typeof entry !== "object" || !entry) continue;
            const w = entry as RegistryWorkerEntry;
            if (w.pane_id && !checkPaneAlive(w.pane_id)) {
              w.pane_id = null; w.pane_target = null; w.session_id = null;
            }
          }
          return { ...reg };
        });

        const projectName = basename(PROJECT_ROOT);
        let output = `=== Fleet Status (${projectName}) ===\n${new Date().toISOString()}\n\n`;
        const header = `${"Worker".padEnd(22)} ${"Runtime".padEnd(9)} ${"Status".padEnd(10)} ${"Pane".padEnd(12)} ${"Active Task"}`;
        output += header + "\n" + `${"------".padEnd(22)} ${"-------".padEnd(9)} ${"------".padEnd(10)} ${"----".padEnd(12)} ${"-----------"}\n`;

        const entries = Object.entries(registry).filter(([k]) => k !== "_config").sort(([a], [b]) => a.localeCompare(b));
        for (const [n, entry] of entries) {
          const w = entry as RegistryWorkerEntry;
          const task = ""; // Tasks are now LKML mail threads — no local lookup
          const paneStatus = w.pane_id ? (checkPaneAlive(w.pane_id) ? `${w.pane_id}` : `${w.pane_id} DEAD`) : "—";
          const runtime = String(w.custom?.runtime || "claude");
          output += `${n.padEnd(22)} ${runtime.padEnd(9)} ${String(w.status || "?").padEnd(10)} ${paneStatus.padEnd(12)} ${task}\n`;
        }

        // Custom state
        const stateLines: string[] = [];
        for (const [n, entry] of entries) {
          const w = entry as RegistryWorkerEntry;
          if (w.custom && Object.keys(w.custom).length > 0) {
            stateLines.push(`  ${n}: ${Object.entries(w.custom).map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`).join(", ")}`);
          }
        }
        if (stateLines.length > 0) output += "\n=== State ===\n" + stateLines.join("\n") + "\n";

        return withLint({ content: [{ type: "text" as const, text: output }] });
      }

      // Single worker state
      const targetName = name || WORKER_NAME;
      const entry = getWorkerEntry(targetName);
      if (!entry) {
        return { content: [{ type: "text" as const, text: `No state for worker '${targetName}'` }], isError: true };
      }
      const state: Record<string, any> = {
        status: entry.status,
        perpetual: entry.perpetual,
        sleep_duration: entry.sleep_duration,
        ...entry.custom,
      };
      if (entry.last_commit_sha) state.last_commit_sha = entry.last_commit_sha;
      if (entry.last_commit_msg) state.last_commit_msg = entry.last_commit_msg;
      if (entry.last_commit_at) state.last_commit_at = entry.last_commit_at;
      if (entry.issues_found) state.issues_found = entry.issues_found;
      if (entry.issues_fixed) state.issues_fixed = entry.issues_fixed;
      return withLint({ content: [{ type: "text" as const, text: JSON.stringify(state, null, 2) }] });
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "update_state",
  { description: "Write a key-value pair to the worker registry that persists across recycles. Use for sleep_duration, custom metrics, feature flags, or any state that must survive restarts. Known keys (status, perpetual, sleep_duration, last_commit_sha/msg/at, issues_found/fixed, report_to) are stored at the top level; all other keys go into the custom state bag. Cross-worker updates require authority — you must be the target's report_to or the mission_authority.", inputSchema: {
    key: z.string().describe("State key name. Known keys (status, perpetual, sleep_duration, report_to, model, permission_mode, disallowed_tools, branch, worktree, mission_file, pane_id, pane_target, tmux_session, window, session_id, session_file, bms_token, forked_from, last_commit_sha, last_commit_msg, last_commit_at, issues_found, issues_fixed) go top-level. Any other key goes into the custom state bag"),
    value: z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())]).describe("Value to store. Primitives, null, or string arrays (for disallowed_tools)"),
    worker: z.string().optional().describe("Target worker. Omit to update your own state. Cross-worker updates are authorized only if you are the target's report_to or the mission_authority"),
  } },
  async ({ key, value, worker }) => {
    try {
      const targetName = worker || WORKER_NAME;

      // Write to project registry
      let stateJson: string = "";
      withRegistryLocked((registry) => {
        // Authorization check for cross-worker updates
        if (targetName !== WORKER_NAME && !canUpdateWorker(WORKER_NAME, targetName, registry)) {
          throw new Error(`Not authorized to update '${targetName}' — you are not their report_to or the mission_authority`);
        }

        const entry = ensureWorkerInRegistry(registry, targetName);
        // Allowlist of top-level fields (all worker entry fields are now editable)
        const STATE_KEYS = new Set(["status","perpetual","sleep_duration",
          "last_commit_sha","last_commit_msg","last_commit_at","issues_found","issues_fixed","report_to",
          "model","permission_mode","disallowed_tools","branch","worktree","mission_file",
          "pane_id","pane_target","tmux_session","window","session_id","session_file","bms_token","forked_from"]);
        if (STATE_KEYS.has(key)) {
          (entry as any)[key] = value;
        } else {
          entry.custom[key] = value;
        }
        stateJson = JSON.stringify(entry, null, 2) + "\n";
      });

      // Sync to watchdog config-cache (best-effort, bypasses macOS TCC restrictions)
      try {
        const cacheDir = join(
          process.env.HOME || "/tmp",
          ".claude-ops/state/harness-runtime/worker",
          targetName
        );
        if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
        writeFileSync(join(cacheDir, "config-cache.json"), stateJson);
      } catch {}

      // Emit bus event (best-effort)
      try {
        const payload = JSON.stringify({
          worker: targetName, key, value, channel: "worker-fleet-mcp", updated_by: WORKER_NAME,
        });
        execSync(
          `source "${CLAUDE_OPS}/lib/event-bus.sh" && bus_publish "agent.state-changed" '${payload.replace(/'/g, "'\\''")}'`,
          { cwd: PROJECT_ROOT, timeout: 5000, encoding: "utf-8", shell: "/bin/bash" }
        );
      } catch {}

      const prefix = targetName !== WORKER_NAME ? `${targetName}.` : "state.";
      return withLint({ content: [{ type: "text" as const, text: `Updated ${prefix}${key} = ${JSON.stringify(value)}` }] });
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// fleet_status removed — merged into get_worker_state(name="all")

server.registerTool(
  "update_config",
  { description: "Update fleet-wide _config fields in the registry (commit_notify, merge_authority, deploy_authority, mission_authority, tmux_session, project_name, window_groups). Only mission_authority or operator can call this.", inputSchema: {
    key: z.string().describe("Config key: commit_notify, merge_authority, deploy_authority, mission_authority, tmux_session, project_name, window_groups"),
    value: z.union([z.string(), z.array(z.string()), z.record(z.string(), z.array(z.string()))]).describe("Value. mission_authority and commit_notify accept string or string[]; window_groups accepts Record<string, string[]>; others accept strings"),
  } },
  async ({ key, value }) => {
    try {
      const validKeys = new Set(["commit_notify", "merge_authority", "deploy_authority",
        "mission_authority", "tmux_session", "project_name", "window_groups"]);
      if (!validKeys.has(key)) {
        return { content: [{ type: "text" as const, text: `Invalid config key '${key}'. Valid: ${[...validKeys].join(", ")}` }], isError: true };
      }

      withRegistryLocked((registry) => {
        const config = registry._config as RegistryConfig;
        // Authorization: only mission_authority or operator
        if (!isMissionAuthority(WORKER_NAME, config) && WORKER_NAME !== "operator" && WORKER_NAME !== "user") {
          throw new Error(`Only ${getMissionAuthorityLabel(config)} (mission_authority) or operator can update _config`);
        }
        (config as any)[key] = value;
      });

      return { content: [{ type: "text" as const, text: `Updated _config.${key} = ${JSON.stringify(value)}` }] };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// WORKER CONFIG TOOL — per-worker config.json updates
// ═══════════════════════════════════════════════════════════════════

server.registerTool(
  "update_worker_config",
  {
    description: `Update a worker's per-worker config.json. Workers can update their OWN config only. For other workers, suggest changes via Fleet Mail.

Self-writable keys: model, reasoning_effort, sleep_duration, window, mcp, worktree, branch
Self-writable (add only): hooks (with owner:"self")
NOT self-writable: permission_mode, meta.*
Hook removal: workers can only remove hooks where owner === "self"`,
    inputSchema: {
      key: z.string().describe('Config key to update. Writable: model, reasoning_effort, sleep_duration, window, mcp, worktree, branch. Hook ops: hooks.add (value=hook object), hooks.remove (value=hook ID)'),
      value: z.union([z.string(), z.number(), z.boolean(), z.null(), z.record(z.string(), z.any())]).describe("Value to set. For hooks.add: JSON object with event, tool, condition, action, message fields. For hooks.remove: hook ID string"),
      worker: z.string().optional().describe("Target worker name. Omit for self. Only mission_authority can update others"),
    },
  },
  async ({ key, value, worker }) => {
    try {
      const targetName = worker || WORKER_NAME;
      const isSelf = targetName === WORKER_NAME;
      const fleetConfig = readFleetConfig();

      // Authorization: self or mission_authority
      if (!isSelf && !isMissionAuthority(WORKER_NAME, fleetConfig)) {
        return { content: [{ type: "text" as const, text: `Cannot update '${targetName}' config — only self or mission_authority. Suggest changes via Fleet Mail.` }], isError: true };
      }

      const config = readWorkerConfig(targetName);
      if (!config) {
        return { content: [{ type: "text" as const, text: `Worker '${targetName}' not found in fleet dir` }], isError: true };
      }

      // Self-writable keys
      const selfWritable = new Set(["model", "reasoning_effort", "sleep_duration", "window", "mcp", "worktree", "branch"]);

      if (key === "hooks.add") {
        // Add a hook with owner:"self"
        const hookData = value as any;
        if (!hookData || typeof hookData !== "object" || !hookData.event) {
          return { content: [{ type: "text" as const, text: "Hook must have at least an 'event' field" }], isError: true };
        }
        const newHook = {
          ...hookData,
          id: `self-${Date.now()}`,
          owner: "self",
        };
        config.hooks.push(newHook);
        writeWorkerConfig(targetName, config);
        return withLint({ content: [{ type: "text" as const, text: `Added hook [${newHook.id}] to ${targetName}/config.json` }] });
      }

      if (key === "hooks.remove") {
        const hookId = String(value);
        const hookIdx = config.hooks.findIndex((h: any) => h.id === hookId);
        if (hookIdx === -1) {
          return { content: [{ type: "text" as const, text: `Hook '${hookId}' not found` }], isError: true };
        }
        const hook = config.hooks[hookIdx] as any;
        if (isSelf && hook.owner !== "self") {
          return { content: [{ type: "text" as const, text: `Cannot remove hook '${hookId}' — owner is '${hook.owner}', not 'self'` }], isError: true };
        }
        config.hooks.splice(hookIdx, 1);
        writeWorkerConfig(targetName, config);
        return withLint({ content: [{ type: "text" as const, text: `Removed hook [${hookId}] from ${targetName}/config.json` }] });
      }

      // Reject non-self-writable keys for self-updates
      if (isSelf && !selfWritable.has(key)) {
        return { content: [{ type: "text" as const, text: `Key '${key}' is not self-writable. Self-writable: ${[...selfWritable].join(", ")}` }], isError: true };
      }
      if (key.startsWith("meta.")) {
        return { content: [{ type: "text" as const, text: `meta.* fields are read-only` }], isError: true };
      }

      // Update the config
      (config as any)[key] = value;
      writeWorkerConfig(targetName, config);

      // Regenerate launch.sh if relevant keys changed
      if (["model", "reasoning_effort", "permission_mode", "worktree"].includes(key)) {
        writeLaunchScript(targetName, config);
      }

      return withLint({ content: [{ type: "text" as const, text: `Updated ${targetName}/config.json: ${key} = ${JSON.stringify(value)}` }] });
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
    }
  }
);

} // end registerStateTools
