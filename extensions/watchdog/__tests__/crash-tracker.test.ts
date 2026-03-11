import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";

// Override CRASH_DIR before importing
const TEST_CRASH_DIR = `/tmp/watchdog-test-crashes-${process.pid}`;
process.env.CLAUDE_OPS_DIR = `/tmp/watchdog-test-ops-${process.pid}`;

import { incrementCrashCount, readCrashTimestamps, isCrashLooped, markCrashLoop, clearCrashLoop, clearCrashData } from "../src/crash-tracker";

describe("crash-tracker", () => {
  beforeEach(() => {
    // Ensure crash dir exists fresh
    rmSync(TEST_CRASH_DIR, { recursive: true, force: true });
    mkdirSync(TEST_CRASH_DIR, { recursive: true });
    // Also create the parent dir structure that crash-tracker expects
    const crashDir = join(process.env.CLAUDE_OPS_DIR!, "state/watchdog-crashes");
    rmSync(crashDir, { recursive: true, force: true });
    mkdirSync(crashDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_CRASH_DIR, { recursive: true, force: true });
    rmSync(process.env.CLAUDE_OPS_DIR!, { recursive: true, force: true });
  });

  test("0 crashes returns 1 after first increment", () => {
    const now = Math.floor(Date.now() / 1000);
    const count = incrementCrashCount("worker-a", now);
    expect(count).toBe(1);
  });

  test("increments crash count correctly", () => {
    const now = Math.floor(Date.now() / 1000);
    incrementCrashCount("worker-a", now - 100);
    incrementCrashCount("worker-a", now - 50);
    const count = incrementCrashCount("worker-a", now);
    expect(count).toBe(3);
  });

  test("prunes crashes older than 1 hour", () => {
    const now = Math.floor(Date.now() / 1000);
    incrementCrashCount("worker-a", now - 7200); // 2 hours ago
    incrementCrashCount("worker-a", now - 5400); // 1.5 hours ago
    const count = incrementCrashCount("worker-a", now);
    expect(count).toBe(1); // only the current one remains
  });

  test("crash-loop detection with 3 crashes within hour", () => {
    const now = Math.floor(Date.now() / 1000);
    incrementCrashCount("worker-a", now - 300);
    incrementCrashCount("worker-a", now - 100);
    const count = incrementCrashCount("worker-a", now);
    expect(count).toBe(3);
    // 3 >= maxCrashesPerHr=3, so it should be treated as crash-looped
  });

  test("4 crashes in hour exceeds threshold", () => {
    const now = Math.floor(Date.now() / 1000);
    incrementCrashCount("worker-a", now - 400);
    incrementCrashCount("worker-a", now - 300);
    incrementCrashCount("worker-a", now - 100);
    const count = incrementCrashCount("worker-a", now);
    expect(count).toBe(4);
  });

  test("isCrashLooped returns false initially", () => {
    expect(isCrashLooped("worker-a")).toBe(false);
  });

  test("markCrashLoop + isCrashLooped", () => {
    markCrashLoop("worker-a");
    expect(isCrashLooped("worker-a")).toBe(true);
  });

  test("clearCrashLoop removes flag", () => {
    markCrashLoop("worker-a");
    expect(isCrashLooped("worker-a")).toBe(true);
    clearCrashLoop("worker-a");
    expect(isCrashLooped("worker-a")).toBe(false);
  });

  test("readCrashTimestamps returns empty array for unknown worker", () => {
    expect(readCrashTimestamps("nonexistent")).toEqual([]);
  });

  test("clearCrashData removes both files", () => {
    const now = Math.floor(Date.now() / 1000);
    incrementCrashCount("worker-a", now);
    markCrashLoop("worker-a");
    clearCrashData("worker-a");
    expect(isCrashLooped("worker-a")).toBe(false);
    expect(readCrashTimestamps("worker-a")).toEqual([]);
  });

  test("mixed old and recent crashes", () => {
    const now = Math.floor(Date.now() / 1000);
    // 2 old (should be pruned), 2 recent
    incrementCrashCount("worker-a", now - 7200);
    incrementCrashCount("worker-a", now - 3700);
    incrementCrashCount("worker-a", now - 500);
    const count = incrementCrashCount("worker-a", now);
    expect(count).toBe(2); // only the 2 within last hour
  });

  test("separate workers have independent crash counts", () => {
    const now = Math.floor(Date.now() / 1000);
    incrementCrashCount("worker-a", now);
    incrementCrashCount("worker-a", now);
    incrementCrashCount("worker-b", now);
    expect(readCrashTimestamps("worker-a").length).toBe(2);
    expect(readCrashTimestamps("worker-b").length).toBe(1);
  });
});
