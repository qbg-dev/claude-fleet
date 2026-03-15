/**
 * fleet round-stop — Full cycle end: checkpoint + handoff + notify + sleep.
 *
 * Usage:
 *   fleet round-stop "<message>" [--skip-push]
 *
 * Replaces the MCP round_stop() tool for CLI usage.
 * Steps: save checkpoint → update state → write handoff.md → notify mission_authority → git commit+push
 */

import type { Command } from "commander";
import {
  readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync,
  unlinkSync, symlinkSync, renameSync,
} from "node:fs";
import { join, basename } from "node:path";
import {
  FLEET_DATA, FLEET_MAIL_URL, resolveProject, resolveProjectRoot, workerDir,
} from "../lib/paths";
import { ok, info, warn, fail } from "../lib/fmt";
import { addGlobalOpts } from "../index";

// ── JSON Helpers ────────────────────────────────────────────────

function readJson<T>(path: string): T | null {
  try { return JSON.parse(readFileSync(path, "utf-8")); } catch { return null; }
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

// ── Path Resolution ─────────────────────────────────────────────

function resolveWorkerName(): string {
  if (process.env.WORKER_NAME) return process.env.WORKER_NAME;
  try {
    const result = Bun.spawnSync(["git", "rev-parse", "--abbrev-ref", "HEAD"], { stderr: "pipe" });
    if (result.exitCode === 0) {
      const branch = result.stdout.toString().trim();
      if (branch.startsWith("worker/")) return branch.slice("worker/".length);
    }
    // Worktree suffix detection
    const dirName = basename(process.cwd());
    const match = dirName.match(/-w-(.+)$/);
    if (match) return match[1];
  } catch {}
  return "operator";
}

// ── Git State Capture ───────────────────────────────────────────

function captureGitState(): { branch?: string; sha?: string; dirty_count: number; staged_count: number } {
  try {
    const opts = { stderr: "pipe" as const };
    const branch = Bun.spawnSync(["git", "rev-parse", "--abbrev-ref", "HEAD"], opts).stdout.toString().trim();
    const sha = Bun.spawnSync(["git", "rev-parse", "--short", "HEAD"], opts).stdout.toString().trim();
    const porcelain = Bun.spawnSync(["git", "status", "--porcelain"], opts).stdout.toString().trim();
    const lines = porcelain ? porcelain.split("\n") : [];
    const staged = lines.filter(l => /^[MADRC]/.test(l)).length;
    const dirty = lines.filter(l => /^.[MADRC?]/.test(l)).length;
    return { branch, sha, dirty_count: dirty, staged_count: staged };
  } catch {
    return { dirty_count: 0, staged_count: 0 };
  }
}

// ── Hooks Snapshot ──────────────────────────────────────────────

function captureHooks(project: string, workerName: string): unknown[] | null {
  const hooksFile = join(FLEET_DATA, project, workerName, "hooks", "hooks.json");
  if (!existsSync(hooksFile)) return null;
  try {
    const data = JSON.parse(readFileSync(hooksFile, "utf-8"));
    return data.hooks || [];
  } catch {
    return null;
  }
}

// ── Checkpoint GC ───────────────────────────────────────────────

function gcCheckpoints(checkpointDir: string, keep: number): void {
  try {
    const files = readdirSync(checkpointDir)
      .filter(f => f.startsWith("checkpoint-") && f.endsWith(".json"))
      .sort(); // ISO timestamps sort lexicographically

    if (files.length <= keep) return;

    const toDelete = files.slice(0, files.length - keep);
    for (const f of toDelete) {
      try { unlinkSync(join(checkpointDir, f)); } catch {}
    }
  } catch {}
}

// ── Fleet Mail Namespace ────────────────────────────────────────

function mailAccountName(localName: string, project: string): string {
  if (localName.includes("@") || localName.startsWith("list:")) return localName;
  return `${localName}@${project.toLowerCase()}`;
}

// ── Main ────────────────────────────────────────────────────────

async function runRoundStop(
  message: string,
  opts: { skipPush?: boolean },
  globalOpts: Record<string, unknown>,
): Promise<void> {
  const projectRoot = resolveProjectRoot();
  const project = (globalOpts.project as string) || resolveProject(projectRoot);
  const workerName = resolveWorkerName();
  const wDir = workerDir(project, workerName);

  if (!existsSync(wDir)) {
    fail(`Worker directory not found: ${wDir}`);
  }

  // ── Step 1: Save checkpoint (type: "round-stop") ──────────────
  const gitState = captureGitState();
  const hooks = captureHooks(project, workerName);
  const timestamp = new Date().toISOString();

  const checkpoint: Record<string, unknown> = {
    timestamp,
    type: "round-stop",
    summary: message,
    git_state: gitState,
  };
  if (hooks) checkpoint.dynamic_hooks = hooks;
  checkpoint.key_facts = [];
  checkpoint.transcript_ref = "";

  const checkpointDir = join(wDir, "checkpoints");
  mkdirSync(checkpointDir, { recursive: true });

  const safeTimestamp = timestamp.replace(/:/g, "-").replace(/\./g, "-");
  const filename = `checkpoint-${safeTimestamp}.json`;
  const filePath = join(checkpointDir, filename);
  writeFileSync(filePath, JSON.stringify(checkpoint, null, 2));

  // Update latest.json symlink atomically
  const latestPath = join(checkpointDir, "latest.json");
  const tmpPath = join(checkpointDir, ".latest.json.tmp");
  try { unlinkSync(tmpPath); } catch {}
  try {
    symlinkSync(filename, tmpPath);
    renameSync(tmpPath, latestPath);
  } catch {
    try { unlinkSync(latestPath); } catch {}
    try { symlinkSync(filename, latestPath); } catch {}
  }

  // GC: keep last 5
  gcCheckpoints(checkpointDir, 5);

  const shaNote = gitState.sha ? ` @ ${gitState.sha}` : "";
  ok(`Checkpoint saved: ${filename}${shaNote}`);

  // ── Step 2: Update state ──────────────────────────────────────
  const statePath = join(wDir, "state.json");
  const configPath = join(wDir, "config.json");
  const state = readJson<Record<string, unknown>>(statePath) || {};
  const config = readJson<Record<string, unknown>>(configPath) || {};

  if (!state.custom || typeof state.custom !== "object") {
    state.custom = {};
  }
  (state.custom as Record<string, unknown>).last_cycle_at = new Date().toISOString();

  const sleepDuration = config.sleep_duration as number | null | undefined;
  let sleepNote = "";
  if (sleepDuration && sleepDuration > 0) {
    state.status = "sleeping";
    const wakeAt = new Date(Date.now() + sleepDuration * 1000).toISOString();
    (state.custom as Record<string, unknown>).sleep_until = wakeAt;
    sleepNote = `Sleeping for ${sleepDuration}s (wake at ${wakeAt})`;
  }

  writeJson(statePath, state);
  if (sleepNote) {
    info(sleepNote);
  }

  // ── Step 3: Write handoff.md ──────────────────────────────────
  const handoffPath = join(wDir, "handoff.md");
  writeFileSync(handoffPath, message.trim() + "\n");
  ok("Handoff written");

  // ── Step 4: Notify mission_authority (best-effort) ────────────
  try {
    const fleetJsonPath = join(FLEET_DATA, project, "fleet.json");
    if (existsSync(fleetJsonPath) && FLEET_MAIL_URL) {
      const fleetConfig = readJson<Record<string, unknown>>(fleetJsonPath);
      const maList = fleetConfig?.mission_authority;
      const operatorNames: string[] = !maList
        ? []
        : Array.isArray(maList) ? maList : [maList as string];
      const filteredOps = operatorNames.filter(n => n !== workerName);

      if (filteredOps.length > 0) {
        const tokenPath = join(wDir, "token");
        if (existsSync(tokenPath)) {
          const token = readFileSync(tokenPath, "utf-8").trim();
          if (token) {
            const toNames = filteredOps.map(n => mailAccountName(n, project));
            const resp = await fetch(`${FLEET_MAIL_URL}/api/messages/send`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                to: toNames,
                subject: `${workerName} round done`,
                body: `[${workerName}] Round complete: ${message}`,
                labels: ["CYCLE-REPORT"],
              }),
              signal: AbortSignal.timeout(10_000),
            });
            if (resp.ok) {
              info(`Notified: ${filteredOps.join(", ")}`);
            }
          }
        }
      }
    }
  } catch {
    // best-effort — ignore errors
  }

  // ── Step 5: Git commit + push (unless --skip-push) ────────────
  if (!opts.skipPush) {
    let pushResult = "";
    try {
      const spawnOpts = { stderr: "pipe" as const, timeout: 15_000 };

      // Stage all changes
      Bun.spawnSync(["git", "add", "-A"], spawnOpts);

      // Commit if there are staged changes
      const status = Bun.spawnSync(["git", "status", "--porcelain"], spawnOpts).stdout.toString().trim();
      if (status) {
        const commitMsg = `checkpoint: ${workerName} round_stop\n\n${message.slice(0, 200)}`;
        Bun.spawnSync(["git", "commit", "-m", commitMsg], spawnOpts);
      }

      // Push to remote (create tracking branch if needed)
      const branch = Bun.spawnSync(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        { stderr: "pipe" },
      ).stdout.toString().trim();

      const pushRes = Bun.spawnSync(["git", "push", "origin", branch], { stderr: "pipe", timeout: 30_000 });
      if (pushRes.exitCode !== 0) {
        // Fallback: push with -u to create tracking branch
        const pushU = Bun.spawnSync(["git", "push", "-u", "origin", branch], { stderr: "pipe", timeout: 30_000 });
        if (pushU.exitCode === 0) {
          pushResult = `Pushed ${branch} to origin (new tracking branch)`;
        } else {
          pushResult = `Push failed: ${pushU.stderr.toString().trim().slice(0, 100)}`;
        }
      } else {
        pushResult = `Pushed ${branch} to origin`;
      }
    } catch (e: any) {
      pushResult = `Push failed: ${e.message?.slice(0, 100) || "unknown error"}`;
    }

    if (pushResult.startsWith("Push failed")) {
      warn(pushResult);
    } else if (pushResult) {
      ok(pushResult);
    }
  } else {
    info("Skipped git push (--skip-push)");
  }

  // ── Step 6: Summary ───────────────────────────────────────────
  const handoffPreview = message.length > 120 ? message.slice(0, 120) + "..." : message;
  info(`Handoff: "${handoffPreview}"`);

  if (sleepDuration && sleepDuration > 0) {
    info("Entering sleep — watchdog will respawn after sleep_duration expires");
  } else {
    info("Keep working — check inbox for new tasks, or go idle if nothing pending");
  }
}

// ── Registration ────────────────────────────────────────────────

export function register(parent: Command): void {
  const cmd = parent
    .command("round-stop <message>")
    .description("End a work round: checkpoint + handoff + notify + sleep")
    .option("--skip-push", "Skip git commit and push");
  addGlobalOpts(cmd)
    .action(async (message: string, opts: { skipPush?: boolean }, cmd: Command) => {
      await runRoundStop(message, opts, cmd.optsWithGlobals());
    });
}
