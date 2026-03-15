/**
 * fleet checkpoint — Save a lightweight mid-work snapshot.
 *
 * Usage:
 *   fleet checkpoint "<summary>" [--key-facts "fact1" "fact2"]
 *
 * Captures git state, dynamic hooks, and transcript reference.
 * Keeps last 5 checkpoints with GC.
 */

import type { Command } from "commander";
import {
  readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync,
  unlinkSync, symlinkSync, renameSync,
} from "node:fs";
import { join, basename } from "node:path";
import { FLEET_DATA, resolveProject, resolveProjectRoot, workerDir } from "../lib/paths";
import { ok, fail } from "../lib/fmt";
import { addGlobalOpts } from "../index";

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

// ── Transcript Reference ────────────────────────────────────────

function findTranscriptRef(): string | null {
  const HOME = process.env.HOME || process.env.USERPROFILE || "/tmp";
  const projectsDir = join(HOME, ".claude", "projects");
  if (!existsSync(projectsDir)) return null;

  // Resolve the current worktree root to match against project slugs
  const projectRoot = resolveProjectRoot();
  const rootName = basename(projectRoot);

  try {
    const slugs = readdirSync(projectsDir).filter(d => {
      // Project slug directories encode the path with dashes
      return d.includes(rootName) || d.includes(rootName.replace(/-w-.*$/, ""));
    });

    let latestFile: string | null = null;
    let latestMtime = 0;

    for (const slug of slugs) {
      const slugDir = join(projectsDir, slug);
      try {
        const files = readdirSync(slugDir).filter(f => f.endsWith(".jsonl"));
        for (const f of files) {
          const fullPath = join(slugDir, f);
          const stat = Bun.spawnSync(["stat", "-f", "%m", fullPath], { stderr: "pipe" });
          const mtime = parseInt(stat.stdout.toString().trim(), 10);
          if (mtime > latestMtime) {
            latestMtime = mtime;
            latestFile = fullPath;
          }
        }
      } catch {}
    }

    return latestFile;
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

// ── Main ────────────────────────────────────────────────────────

async function saveCheckpoint(
  summary: string,
  opts: { keyFacts?: string[] },
  globalOpts: Record<string, unknown>,
): Promise<void> {
  const projectRoot = resolveProjectRoot();
  const project = (globalOpts.project as string) || resolveProject(projectRoot);
  const workerName = resolveWorkerName();

  // Validate key facts
  if (opts.keyFacts && opts.keyFacts.length > 10) {
    fail("Maximum 10 key facts allowed");
  }

  // Capture state
  const git_state = captureGitState();
  const dynamic_hooks = captureHooks(project, workerName);
  const transcript_ref = findTranscriptRef();
  const timestamp = new Date().toISOString();

  // Build checkpoint object
  const checkpoint: Record<string, unknown> = {
    timestamp,
    type: "manual",
    summary,
    git_state,
  };
  if (dynamic_hooks) checkpoint.dynamic_hooks = dynamic_hooks;
  if (opts.keyFacts && opts.keyFacts.length > 0) checkpoint.key_facts = opts.keyFacts;
  if (transcript_ref) checkpoint.transcript_ref = transcript_ref;

  // Write checkpoint file
  const wDir = workerDir(project, workerName);
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
    // Fallback: direct symlink if rename fails
    try { unlinkSync(latestPath); } catch {}
    try { symlinkSync(filename, latestPath); } catch {}
  }

  // GC: keep last 5
  gcCheckpoints(checkpointDir, 5);

  const shaNote = git_state.sha ? ` @ ${git_state.sha}` : "";
  const factsNote = opts.keyFacts ? ` [${opts.keyFacts.length} facts]` : "";
  ok(`Checkpoint saved: ${filename}${shaNote}${factsNote}`);
}

// ── Registration ────────────────────────────────────────────────

export function register(parent: Command): void {
  const cmd = parent
    .command("checkpoint <summary>")
    .description("Save a checkpoint of current working state")
    .option("--key-facts <facts...>", "Important facts to preserve across context boundaries (max 10)");
  addGlobalOpts(cmd)
    .action(async (summary: string, opts: { keyFacts?: string[] }, cmd: Command) => {
      await saveCheckpoint(summary, opts, cmd.optsWithGlobals());
    });
}
