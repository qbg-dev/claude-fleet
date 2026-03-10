/**
 * Shared configuration — path constants, worker identity, project resolution.
 * Single source of truth for all modules in the MCP server.
 */

import { execSync } from "child_process";
import { join, basename } from "path";
import { existsSync } from "fs";

// ── Path Constants ──────────────────────────────────────────────────
export const HOME = process.env.HOME!;
export const PROJECT_ROOT = process.env.PROJECT_ROOT || process.cwd();
export const CLAUDE_OPS = process.env.TMUX_AGENTS_DIR || process.env.CLAUDE_OPS_DIR || join(HOME, ".tmux-agents");
export let WORKERS_DIR = join(PROJECT_ROOT, ".claude/workers");

/** For testing — override the workers directory */
export function _setWorkersDir(dir: string) { WORKERS_DIR = dir; }

export const HARNESS_LOCK_DIR = join(CLAUDE_OPS, "state/locks");

/** Derive canonical project name — strips worktree suffix (-w-*) */
export function resolveProjectName(): string {
  return basename(PROJECT_ROOT).replace(/-w-.*$/, '');
}

/** Single-source fleet directory outside git — per-worker subdirectories */
export const FLEET_DIR = join(HOME, ".claude/fleet", resolveProjectName());
export const REGISTRY_PATH = join(FLEET_DIR, "registry.json");
export const FLEET_CONFIG_PATH = join(FLEET_DIR, "fleet.json");
export const LEGACY_REGISTRY_PATH = join(PROJECT_ROOT, ".claude/workers/registry.json");

// ── Worker Identity Detection ────────────────────────────────────────
function detectWorkerName(): string {
  if (process.env.WORKER_NAME) return process.env.WORKER_NAME;
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: process.cwd(), encoding: "utf-8", timeout: 5000,
    }).trim();
    if (branch.startsWith("worker/")) return branch.slice("worker/".length);
    // On main branch, derive from worktree directory name (e.g. Wechat-w-merger → merger)
    const dirName = basename(process.cwd());
    const match = dirName.match(/-w-(.+)$/);
    if (match) return match[1];
  } catch {}
  return "operator";
}

export const WORKER_NAME = detectWorkerName();

// Cache git branch at module load for fast diagnostics (no subprocess at check time)
let _cachedBranchValue: string | null = null;
try {
  _cachedBranchValue = execSync("git rev-parse --abbrev-ref HEAD", {
    cwd: process.cwd(), encoding: "utf-8", timeout: 5000,
  }).trim();
} catch {}
export const _cachedBranch = _cachedBranchValue;

export const LINT_ENABLED = process.env.WORKER_FLEET_LINT !== "0";

/** Compute the worktree directory path (PROJECT_ROOT/../ProjectName-w-WORKER) */
export function getWorktreeDir(): string {
  const projectName = PROJECT_ROOT.split("/").pop()!;
  return join(PROJECT_ROOT, "..", `${projectName}-w-${WORKER_NAME}`);
}

// ── Fleet Mail Constants ─────────────────────────────────────────────
export const FLEET_MAIL_URL = process.env.FLEET_MAIL_URL ?? "http://127.0.0.1:8025";
export const FLEET_MAIL_PROJECT = resolveProjectName().toLowerCase();
