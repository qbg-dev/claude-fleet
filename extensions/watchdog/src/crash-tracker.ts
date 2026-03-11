/**
 * Crash tracking + crash-loop detection.
 * Tracks crash timestamps per worker, prunes old crashes, detects loops.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

interface CrashData {
  timestamps: number[];
}

/** Resolve crash dir lazily (env may not be set at import time in tests) */
function getCrashDir(): string {
  const HOME = process.env.HOME || "/tmp";
  const opsDir = process.env.CLAUDE_FLEET_DIR || join(HOME, ".claude-fleet");
  return join(opsDir, "state", "watchdog-crashes");
}

/** Get path to a worker's crash tracking file */
function crashFile(worker: string): string {
  return join(getCrashDir(), `${worker}.json`);
}

/** Read crash timestamps for a worker */
export function readCrashTimestamps(worker: string): number[] {
  const f = crashFile(worker);
  if (!existsSync(f)) return [];
  try {
    const data: CrashData = JSON.parse(readFileSync(f, "utf-8"));
    return Array.isArray(data.timestamps) ? data.timestamps : [];
  } catch {
    return [];
  }
}

/** Record a crash, prune old ones (>1hr), return count within last hour */
export function incrementCrashCount(worker: string, nowEpoch: number): number {
  mkdirSync(getCrashDir(), { recursive: true });
  const hourAgo = nowEpoch - 3600;

  const existing = readCrashTimestamps(worker);
  const recent = existing.filter(t => t > hourAgo);
  recent.push(nowEpoch);

  writeFileSync(crashFile(worker), JSON.stringify({ timestamps: recent }) + "\n");
  return recent.length;
}

/** Check if a worker is in crash-loop state (flag file exists) */
export function isCrashLooped(worker: string): boolean {
  return existsSync(join(getCrashDir(), `${worker}.crash-loop`));
}

/** Mark a worker as crash-looped */
export function markCrashLoop(worker: string): void {
  mkdirSync(getCrashDir(), { recursive: true });
  writeFileSync(join(getCrashDir(), `${worker}.crash-loop`), "");
}

/** Clear crash-loop flag */
export function clearCrashLoop(worker: string): void {
  const f = join(getCrashDir(), `${worker}.crash-loop`);
  try { require("fs").unlinkSync(f); } catch {}
}

/** Clear all crash data for a worker */
export function clearCrashData(worker: string): void {
  try { require("fs").unlinkSync(crashFile(worker)); } catch {}
  clearCrashLoop(worker);
}
