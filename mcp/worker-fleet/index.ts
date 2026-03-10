#!/usr/bin/env bun
/**
 * worker-fleet MCP server — Tools for worker fleet coordination.
 *
 * 20 tools (fine-grained, one action per tool):
 *   Tasks:          REMOVED — use LKML (mail threads with TASK labels)
 *   State (4):      get_worker_state, update_state, update_config, update_worker_config
 *   Hooks (4):      add_hook, complete_hook, remove_hook, list_hooks
 *   Lifecycle (2):  recycle, save_checkpoint
 *   Fleet (7):      create_worker, register_worker, deregister_worker, move_worker, standby_worker, fleet_template, fleet_help
 *   Review (1):     deep_review
 *   Mail (4):       mail_send, mail_inbox, mail_read, mail_help
 *
 * All messaging via Fleet Mail (formerly BMS). Tasks tracked as TASK-labeled mail threads (LKML model).
 *
 * Runtime: bun run ~/.claude-ops/mcp/worker-fleet/index.ts (stdio transport)
 * Identity: auto-detected from WORKER_NAME env or git branch (worker/* → name)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// ── Tool modules ─────────────────────────────────────────────────────
import { registerStateTools } from "./tools/state";
import { registerHookTools } from "./tools/hooks";
import { registerLifecycleTools } from "./tools/lifecycle";
import { registerFleetTools } from "./tools/fleet";
import { registerMailTools } from "./tools/mail";
import { registerReviewTools } from "./tools/review";

// ── Server ───────────────────────────────────────────────────────────

const server = new McpServer({
  name: "worker-fleet",
  version: "2.0.0",
});

registerStateTools(server);
registerHookTools(server);
registerLifecycleTools(server);
registerFleetTools(server);
registerMailTools(server);
registerReviewTools(server);

// ── Start ────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.main) {
  main().catch((e) => {
    console.error("worker-fleet MCP server fatal:", e);
    process.exit(1);
  });
}

// ── Exports for testing ──────────────────────────────────────────────
// Re-export everything that the monolith previously exported, preserving
// backward compatibility for tests and external consumers.

// helpers.ts
export { writeToTriageQueue, buildMessageBody, readJsonFile, _replaceMemorySection, _captureGitState, _timestampFilename, _writeCheckpoint } from "./helpers";

// tmux.ts
export { resolveRecipient, isPaneAlive, findOwnPane, getSessionId } from "./tmux";

// registry.ts
export {
  acquireLock, releaseLock,
  readRegistry, getWorkerEntry, withRegistryLocked, ensureWorkerInRegistry,
  getReportTo, canUpdateWorker, getWorkerModel,
  readFleetConfig, writeFleetConfig,
  readWorkerConfig, writeWorkerConfig,
  readWorkerState, writeWorkerState,
  listWorkerNames, getDefaultSystemHooks,
  generateLaunchScript, writeLaunchScript,
  type WorkerConfig, type WorkerState,
  type RegistryConfig, type RegistryWorkerEntry, type ProjectRegistry,
} from "./registry";

// config.ts
export { WORKER_NAME, WORKERS_DIR, HARNESS_LOCK_DIR, REGISTRY_PATH, FLEET_DIR, FLEET_CONFIG_PATH, _setWorkersDir, getWorktreeDir } from "./config";

// diagnostics.ts
export { runDiagnostics, lintRegistry, type DiagnosticIssue } from "./diagnostics";

// hooks.ts
export { _captureHooksSnapshot } from "./hooks";

// seed.ts
export { generateSeedContent } from "./seed";

// runtime.ts
export { type WorkerRuntime, type ReasoningEffort, type RuntimeConfig, getWorkerRuntime, RUNTIMES } from "./runtime";

// tools/fleet.ts
export { createWorkerFiles } from "./tools/fleet";
