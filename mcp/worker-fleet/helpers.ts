/**
 * Pure utility functions — no dependencies on other MCP modules.
 */

import {
  readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync,
  readdirSync, unlinkSync, symlinkSync, renameSync,
} from "fs";
import { join } from "path";
import { execSync, spawnSync } from "child_process";
import { PROJECT_ROOT, getWorktreeDir } from "./config";

// ── JSON / Script Helpers ────────────────────────────────────────────

export function readJsonFile(path: string): any {
  try { return JSON.parse(readFileSync(path, "utf-8")); } catch { return null; }
}

export function runScript(
  cmd: string, args: string[],
  opts: { cwd?: string; timeout?: number } = {}
): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync("bash", [cmd, ...args], {
    cwd: opts.cwd || PROJECT_ROOT, encoding: "utf-8",
    timeout: opts.timeout || 30_000,
    env: { ...process.env, PROJECT_ROOT },
  });
  return {
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    exitCode: result.status ?? 1,
  };
}

// ── Git State Capture ────────────────────────────────────────────────

/** Capture current git branch, SHA, dirty/staged counts */
export function _captureGitState(cwd?: string): { branch?: string; sha?: string; dirty_count: number; staged_count: number } {
  try {
    const opts = { encoding: "utf-8" as const, timeout: 5000, cwd: cwd || getWorktreeDir() };
    const branch = execSync("git rev-parse --abbrev-ref HEAD", opts).trim();
    const sha = execSync("git rev-parse --short HEAD", opts).trim();
    const porcelain = execSync("git status --porcelain", opts).trim();
    const lines = porcelain ? porcelain.split("\n") : [];
    const staged = lines.filter((l: string) => /^[MADRC]/.test(l)).length;
    const dirty = lines.filter((l: string) => /^.[MADRC?]/.test(l)).length;
    return { branch, sha, dirty_count: dirty, staged_count: staged };
  } catch {
    return { dirty_count: 0, staged_count: 0 };
  }
}

// ── Checkpoint Helpers ───────────────────────────────────────────────

/** Generate timestamp-based filename with millisecond precision to avoid same-second collisions.
 *  Format: checkpoint-20260309T143022123Z.json */
export function _timestampFilename(): string {
  return `checkpoint-${new Date().toISOString().replace(/[:.]/g, "").slice(0, 18)}Z.json`;
}

/** Write checkpoint, update latest symlink atomically, GC to keep last N */
export function _writeCheckpoint(
  checkpointDir: string,
  checkpoint: Record<string, unknown>,
  keepCount = 5,
): string {
  mkdirSync(checkpointDir, { recursive: true });
  const filename = _timestampFilename();
  const filepath = join(checkpointDir, filename);
  writeFileSync(filepath, JSON.stringify(checkpoint, null, 2) + "\n");

  // Update latest symlink atomically: write to temp then rename (avoids brief ENOENT window).
  const latestLink = join(checkpointDir, "latest.json");
  const latestTmp = join(checkpointDir, "latest.json.tmp");
  try {
    try { unlinkSync(latestTmp); } catch {}
    symlinkSync(filename, latestTmp);
    renameSync(latestTmp, latestLink);
  } catch {
    // Fallback: non-atomic (original behavior)
    try { unlinkSync(latestLink); } catch {}
    try { symlinkSync(filename, latestLink); } catch {}
  }

  // GC: keep last N. Note: checkpoint-*.json glob never matches 'latest.json' (different prefix).
  try {
    const all = readdirSync(checkpointDir)
      .filter(f => f.startsWith("checkpoint-") && f.endsWith(".json"))
      .sort();
    if (all.length > keepCount) {
      for (const old of all.slice(0, all.length - keepCount)) {
        try { unlinkSync(join(checkpointDir, old)); } catch {}
      }
    }
  } catch {}

  return filepath;
}

// ── Memory Helpers ─────────────────────────────────────────────────

/** Pure helper: upsert a ## Section block in a MEMORY.md string. Exported for testing. */
export function _replaceMemorySection(existing: string, section: string, content: string): string {
  const heading = `## ${section}`;
  const lines = existing.split("\n");
  let sectionStart = -1;
  let sectionEnd = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimEnd() === heading) { sectionStart = i; continue; }
    if (sectionStart !== -1 && i > sectionStart && lines[i].startsWith("## ")) { sectionEnd = i; break; }
  }
  const newBlock = [heading, content.trimEnd(), ""].join("\n");
  if (sectionStart === -1) {
    return existing.trimEnd() + "\n\n" + newBlock + "\n";
  }
  const before = lines.slice(0, sectionStart).join("\n");
  const after = lines.slice(sectionEnd).join("\n");
  return (before ? before + "\n" : "") + newBlock + (after ? "\n" + after : "");
}

// ── Triage / Message Helpers ───────────────────────────────────────

/** Write an escalation entry to the triage queue (.claude/triage/queue.jsonl) */
export function writeToTriageQueue(
  content: string,
  summary: string | undefined,
  fromWorker: string,
  opts?: { options?: string[]; category?: string; urgency?: string },
): { ok: true; id: string } | { ok: false; error: string } {
  try {
    const triageDir = join(PROJECT_ROOT, ".claude/triage");
    if (!existsSync(triageDir)) mkdirSync(triageDir, { recursive: true });
    const triagePath = join(triageDir, "queue.jsonl");
    const id = `tq-${Date.now()}`;
    const entry: Record<string, any> = {
      id,
      category: opts?.category || (opts?.options?.length ? "worker-question" : "worker-escalation"),
      title: summary || content.slice(0, 60),
      detail: content,
      source: fromWorker,
      from_worker: fromWorker,
      added_at: new Date().toISOString(),
      status: "pending",
    };
    if (opts?.options?.length) entry.options = opts.options;
    if (opts?.urgency) entry.urgency = opts.urgency;
    appendFileSync(triagePath, JSON.stringify(entry) + "\n");
    return { ok: true, id };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

/** Build structured message body from content + optional context/options */
export function buildMessageBody(content: string, context?: string, options?: string[]): string {
  let body = content;
  if (context) body += `\n\n---\n${context}`;
  if (options?.length) body += `\n\nOptions:\n${options.map((o, i) => `  ${i + 1}) ${o}`).join("\n")}`;
  return body;
}
