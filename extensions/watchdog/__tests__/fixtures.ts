/**
 * Test fixtures: mock effects, worker snapshots, config factories.
 */

import type { WatchdogEffects, WorkerSnapshot, WatchdogConfig } from "../src/types";

/** Create a mock WatchdogEffects with call recording */
export function makeMockEffects(overrides?: Partial<WatchdogEffects>): WatchdogEffects & { calls: Record<string, any[][]> } {
  const calls: Record<string, any[][]> = {};

  function record(method: string, args: any[], result: any): any {
    if (!calls[method]) calls[method] = [];
    calls[method].push(args);
    return result;
  }

  const defaults: WatchdogEffects = {
    isPaneAlive: (paneId) => record("isPaneAlive", [paneId], true),
    capturePane: (paneId, lines) => record("capturePane", [paneId, lines], "bypass permissions on\n❯ "),
    getPaneWindow: (paneId) => record("getPaneWindow", [paneId], "workers"),
    readLiveness: (worker) => record("readLiveness", [worker], Math.floor(Date.now() / 1000) - 10),
    writeLiveness: (worker, ts) => record("writeLiveness", [worker, ts], undefined),
    readScrollbackHash: (worker) => record("readScrollbackHash", [worker], null),
    writeScrollbackHash: (worker, hash) => record("writeScrollbackHash", [worker, hash], undefined),
    readStuckCandidate: (worker) => record("readStuckCandidate", [worker], null),
    writeStuckCandidate: (worker, ts) => record("writeStuckCandidate", [worker, ts], undefined),
    clearStuckCandidate: (worker) => record("clearStuckCandidate", [worker], undefined),
    workerHasUnreadMail: async (worker) => record("workerHasUnreadMail", [worker], false),
    nowEpoch: () => record("nowEpoch", [], Math.floor(Date.now() / 1000)),
  };

  const merged = { ...defaults, ...overrides };
  return { ...merged, calls };
}

/** Create a test WorkerSnapshot with sensible defaults */
export function makeSnapshot(overrides?: Partial<WorkerSnapshot>): WorkerSnapshot {
  return {
    name: "test-worker",
    paneId: "%42",
    status: "active",
    sleepDuration: 300,
    window: "workers",
    tmuxSession: "w",
    worktree: "/tmp/test-worktree",
    branch: "worker/test-worker",
    perpetual: true,
    sleepUntil: null,
    lastRelaunchAt: new Date(Date.now() - 600_000).toISOString(),
    createdAt: new Date(Date.now() - 86400_000).toISOString(),
    bmsToken: "test-token",
    model: "opus",
    permissionMode: "bypassPermissions",
    reasoningEffort: "high",
    runtime: "claude",
    ...overrides,
  };
}

/** Create a test WatchdogConfig */
export function makeConfig(overrides?: Partial<WatchdogConfig>): WatchdogConfig {
  return {
    checkInterval: 30,
    stuckThresholdSec: 600,
    maxCrashesPerHr: 3,
    maxCycleSec: 7200,
    memoryLimitMb: 2048,
    ...overrides,
  };
}
