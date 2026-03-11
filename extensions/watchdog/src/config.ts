/**
 * Watchdog configuration — resolution order: env > defaults.json > hardcoded.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { WatchdogConfig } from "./types";

const HOME = process.env.HOME || "/tmp";
const FLEET_DIR = process.env.CLAUDE_FLEET_DIR || join(HOME, ".claude-fleet");

const HARDCODED: WatchdogConfig = {
  checkInterval: 30,
  stuckThresholdSec: 600,
  maxCrashesPerHr: 3,
  maxCycleSec: 7200,
  memoryLimitMb: 2048,
};

/** Read defaults.json from the watchdog extension directory */
function readDefaultsJson(): Partial<WatchdogConfig> {
  // Look in the watchdog extension dir (next to this file's parent)
  const paths = [
    join(__dirname, "..", "defaults.json"),
    join(FLEET_DIR, "extensions/watchdog/defaults.json"),
  ];
  for (const p of paths) {
    if (existsSync(p)) {
      try {
        const raw = JSON.parse(readFileSync(p, "utf-8"));
        return {
          checkInterval: raw.check_interval,
          stuckThresholdSec: raw.stuck_threshold_sec,
          maxCrashesPerHr: raw.max_crashes_per_hr,
          maxCycleSec: raw.max_cycle_sec,
          memoryLimitMb: raw.memory_limit_mb,
        };
      } catch {}
    }
  }
  return {};
}

/** Resolve watchdog configuration */
export function resolveConfig(overrides?: Partial<WatchdogConfig>): WatchdogConfig {
  const fromFile = readDefaultsJson();

  const env = {
    checkInterval: envInt("WATCHDOG_CHECK_INTERVAL"),
    stuckThresholdSec: envInt("WATCHDOG_STUCK_THRESHOLD"),
    maxCrashesPerHr: envInt("WATCHDOG_MAX_CRASHES"),
    maxCycleSec: envInt("WATCHDOG_MAX_CYCLE"),
    memoryLimitMb: envInt("WATCHDOG_MEMORY_LIMIT"),
  };

  return {
    checkInterval: overrides?.checkInterval ?? env.checkInterval ?? fromFile.checkInterval ?? HARDCODED.checkInterval,
    stuckThresholdSec: overrides?.stuckThresholdSec ?? env.stuckThresholdSec ?? fromFile.stuckThresholdSec ?? HARDCODED.stuckThresholdSec,
    maxCrashesPerHr: overrides?.maxCrashesPerHr ?? env.maxCrashesPerHr ?? fromFile.maxCrashesPerHr ?? HARDCODED.maxCrashesPerHr,
    maxCycleSec: overrides?.maxCycleSec ?? env.maxCycleSec ?? fromFile.maxCycleSec ?? HARDCODED.maxCycleSec,
    memoryLimitMb: overrides?.memoryLimitMb ?? env.memoryLimitMb ?? fromFile.memoryLimitMb ?? HARDCODED.memoryLimitMb,
  };
}

function envInt(key: string): number | undefined {
  const v = process.env[key];
  if (v === undefined) return undefined;
  const n = parseInt(v, 10);
  return isNaN(n) ? undefined : n;
}

// ── Path Constants ──

export const CLAUDE_FLEET_DIR = process.env.CLAUDE_FLEET_DIR || join(HOME, ".claude-fleet");
export const STATE_DIR = join(CLAUDE_FLEET_DIR, "state");
export const CRASH_DIR = join(STATE_DIR, "watchdog-crashes");
export const RUNTIME_DIR = join(STATE_DIR, "watchdog-runtime");
export const LOG_FILE = process.env.WATCHDOG_LOG || join(STATE_DIR, "watchdog.log");
export const FLEET_DATA = join(HOME, ".claude/fleet");
export const FLEET_CLI = process.env.FLEET_CLI || join(HOME, ".local/bin/fleet");

/** Resolve project name from PROJECT_ROOT */
export function resolveProjectName(projectRoot: string): string {
  return projectRoot.split("/").pop()!.replace(/-w-.*$/, "");
}

/** Resolve PROJECT_ROOT — env > git > cwd */
export function resolveProjectRoot(): string {
  if (process.env.PROJECT_ROOT) return process.env.PROJECT_ROOT;
  try {
    const result = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], { stderr: "pipe" });
    if (result.exitCode === 0) return result.stdout.toString().trim();
  } catch {}
  return process.cwd();
}
