/**
 * Spawn hooks — extensible behavior executed when watchdog respawns a worker.
 *
 * After TUI is ready, the watchdog executes the worker's on_spawn hooks in order.
 * Default: [{ type: "seed-inject" }] — regenerate and inject the seed template.
 *
 * Hook types:
 *   - seed-inject: Generate seed content and inject via tmux buffer (default)
 *   - command: Run a shell command with worker context as env vars
 *
 * Configuration (per-worker config.json or global defaults.json):
 *   "on_spawn": [
 *     { "type": "seed-inject" },
 *     { "type": "command", "command": "bash ~/.claude-fleet/scripts/post-spawn.sh", "timeout": 10000 }
 *   ]
 *
 * Command hooks receive these environment variables:
 *   WORKER_NAME, WORKER_PANE_ID, PROJECT_ROOT, PROJECT_NAME,
 *   SPAWN_REASON, WORKER_RUNTIME, WORKER_WORKTREE
 */

import { writeFileSync, unlinkSync } from "fs";
import type { SpawnHook } from "./types";
import { logInfo, logWarn, logError } from "./logger";
import { generateSeed } from "./process-manager";

/** Context passed to spawn hooks */
export interface SpawnHookContext {
  workerName: string;
  paneId: string;
  projectRoot: string;
  projectName: string;
  reason: string;
  runtime: string;
  worktree: string;
}

/** Tmux helper (duplicated to avoid circular imports) */
function tmux(...args: string[]): { ok: boolean; stdout: string } {
  const result = Bun.spawnSync(["tmux", ...args], { stderr: "pipe" });
  return { ok: result.exitCode === 0, stdout: result.stdout.toString().trim() };
}

/**
 * Execute all spawn hooks in order for a worker.
 * Called after TUI is ready in the pane.
 */
export async function executeSpawnHooks(
  hooks: SpawnHook[],
  ctx: SpawnHookContext,
): Promise<void> {
  for (const hook of hooks) {
    try {
      switch (hook.type) {
        case "seed-inject":
          await executeSeedInject(ctx);
          break;
        case "command":
          await executeCommand(hook, ctx);
          break;
        default:
          logWarn("SPAWN-HOOK", `unknown hook type: ${(hook as any).type}`, ctx.workerName);
      }
    } catch (err: any) {
      logError("SPAWN-HOOK", `hook ${hook.type} failed: ${err.message || err}`, ctx.workerName);
    }
  }
}

// ── Built-in: seed-inject ──

async function executeSeedInject(ctx: SpawnHookContext): Promise<void> {
  const seed = generateSeed(ctx.workerName, ctx.projectRoot);

  await Bun.sleep(2000);

  const seedFile = `/tmp/worker-${ctx.workerName}-watchdog-seed.txt`;
  writeFileSync(seedFile, seed);
  try {
    const bufName = `watchdog-${ctx.workerName}-${process.pid}`;
    tmux("delete-buffer", "-b", bufName);
    const load = tmux("load-buffer", "-b", bufName, seedFile);
    if (!load.ok) {
      logWarn("SEED-ERR", "failed to load seed into tmux buffer", ctx.workerName);
      return;
    }
    tmux("paste-buffer", "-b", bufName, "-t", ctx.paneId, "-d");
    await Bun.sleep(4000);
    tmux("send-keys", "-t", ctx.paneId, "-H", "0d");

    // Retry Enter after 3s if prompt visible
    await Bun.sleep(3000);
    const { stdout: promptCheck } = tmux("capture-pane", "-t", ctx.paneId, "-p");
    if (promptCheck.split("\n").slice(-3).join("\n").includes("❯")) {
      tmux("send-keys", "-t", ctx.paneId, "-H", "0d");
    }

    logInfo("SPAWN-HOOK", "seed-inject complete", ctx.workerName);
  } finally {
    try { unlinkSync(seedFile); } catch {}
  }
}

// ── Built-in: command ──

async function executeCommand(hook: SpawnHook, ctx: SpawnHookContext): Promise<void> {
  if (!hook.command) {
    logWarn("SPAWN-HOOK", "command hook missing 'command' field", ctx.workerName);
    return;
  }

  const timeout = hook.timeout ?? 30_000;
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    WORKER_NAME: ctx.workerName,
    WORKER_PANE_ID: ctx.paneId,
    PROJECT_ROOT: ctx.projectRoot,
    PROJECT_NAME: ctx.projectName,
    SPAWN_REASON: ctx.reason,
    WORKER_RUNTIME: ctx.runtime,
    WORKER_WORKTREE: ctx.worktree,
  };

  logInfo("SPAWN-HOOK", `running command: ${hook.command}`, ctx.workerName);

  const result = Bun.spawnSync(["bash", "-c", hook.command], {
    env,
    stderr: "pipe",
    stdout: "pipe",
    timeout,
  });

  if (result.exitCode !== 0) {
    const stderr = result.stderr?.toString().trim().slice(0, 200) || "unknown error";
    logWarn("SPAWN-HOOK", `command exited ${result.exitCode}: ${stderr}`, ctx.workerName);
  } else {
    logInfo("SPAWN-HOOK", `command completed (exit 0)`, ctx.workerName);
  }
}
