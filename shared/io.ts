/**
 * Locked JSON read/write utilities shared between CLI and MCP server.
 *
 * Uses the same mkdir-based spinlock as the MCP's `withRegistryLocked()`,
 * ensuring CLI and MCP never race on worker config/state writes.
 *
 * Lock location: ~/.claude-fleet/state/locks/worker-registry
 * (same path the MCP server uses via HARNESS_LOCK_DIR)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { acquireLock, releaseLock } from "./lock-utils";

const HOME = process.env.HOME || process.env.USERPROFILE || "/tmp";
const FLEET_ROOT =
  process.env.CLAUDE_FLEET_DIR ||
  join(HOME, ".claude-fleet");

/** Canonical lock path — shared by CLI and MCP server */
export const REGISTRY_LOCK_PATH = join(FLEET_ROOT, "state", "locks", "worker-registry");

/** Read JSON file, return null on parse failure or missing file */
export function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return null;
  }
}

/** Write JSON file (unlocked). Creates parent dirs. Use for non-shared files only. */
export function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

/**
 * Write JSON file under the worker-registry lock.
 * Use this for any file that both CLI and MCP might write:
 * config.json, state.json, fleet.json, launch.sh.
 */
export function writeJsonLocked(path: string, data: unknown): void {
  mkdirSync(dirname(REGISTRY_LOCK_PATH), { recursive: true });
  if (!acquireLock(REGISTRY_LOCK_PATH)) {
    throw new Error("Could not acquire worker-registry lock after 10s — stale lock?");
  }
  try {
    writeJson(path, data);
  } finally {
    releaseLock(REGISTRY_LOCK_PATH);
  }
}

/**
 * Read-modify-write a JSON file under lock.
 * Prevents lost updates when CLI and MCP both modify the same file.
 */
export function updateJsonLocked<T>(path: string, updater: (current: T | null) => T): T {
  mkdirSync(dirname(REGISTRY_LOCK_PATH), { recursive: true });
  if (!acquireLock(REGISTRY_LOCK_PATH)) {
    throw new Error("Could not acquire worker-registry lock after 10s — stale lock?");
  }
  try {
    const current = readJson<T>(path);
    const updated = updater(current);
    writeJson(path, updated);
    return updated;
  } finally {
    releaseLock(REGISTRY_LOCK_PATH);
  }
}
