import { describe, test, expect } from "bun:test";
import { checkScrollbackStuck, md5Hash } from "../src/stuck-detector";
import { makeMockEffects } from "./fixtures";

describe("stuck-detector", () => {
  test("returns 0 when scrollback content changes", () => {
    const effects = makeMockEffects({
      capturePane: () => "some output\nmore output\nbypass permissions on",
      readScrollbackHash: () => "old-different-hash",
      readStuckCandidate: () => null,
    });

    const result = checkScrollbackStuck("%1", "worker-a", 1000, effects);
    expect(result).toBe(0);
    expect(effects.calls.clearStuckCandidate?.length).toBeGreaterThan(0);
  });

  test("starts candidate when content unchanged (first time)", () => {
    const hash = md5Hash("idle content\nbypass permissions on");
    const effects = makeMockEffects({
      capturePane: () => "idle content\nbypass permissions on",
      readScrollbackHash: () => hash, // same as what we'll compute
      readStuckCandidate: () => null,
    });

    const result = checkScrollbackStuck("%1", "worker-a", 1000, effects);
    expect(result).toBe(0);
    // Should have written stuck candidate
    expect(effects.calls.writeStuckCandidate?.length).toBeGreaterThan(0);
  });

  test("returns idle seconds when content unchanged past threshold", () => {
    const hash = md5Hash("idle content\nbypass permissions on");
    const effects = makeMockEffects({
      capturePane: () => "idle content\nbypass permissions on",
      readScrollbackHash: () => hash,
      readStuckCandidate: () => 500, // was idle since 500
    });

    const result = checkScrollbackStuck("%1", "worker-a", 1200, effects);
    expect(result).toBe(700); // 1200 - 500
  });

  test("detects known blocking patterns", () => {
    const effects = makeMockEffects({
      capturePane: () => "Waiting for task to complete...\nWaiting for task",
      readStuckCandidate: () => 800,
    });

    const result = checkScrollbackStuck("%1", "worker-a", 1000, effects);
    expect(result).toBe(200); // 1000 - 800
  });

  test("blocking pattern starts candidate on first detection", () => {
    const effects = makeMockEffects({
      capturePane: () => "hook error occurred\nhook error repeated",
      readStuckCandidate: () => null,
    });

    const result = checkScrollbackStuck("%1", "worker-a", 1000, effects);
    expect(result).toBe(0);
    expect(effects.calls.writeStuckCandidate).toBeDefined();
  });

  test("clears candidate when content doesn't match stuck patterns", () => {
    const effects = makeMockEffects({
      capturePane: () => "Running tool...\nSearching files\nEditing code",
      readScrollbackHash: () => null,
      readStuckCandidate: () => 500,
    });

    const result = checkScrollbackStuck("%1", "worker-a", 1000, effects);
    expect(result).toBe(0);
    expect(effects.calls.clearStuckCandidate?.length).toBeGreaterThan(0);
  });

  test("md5Hash produces consistent hex output", () => {
    const hash1 = md5Hash("hello world");
    const hash2 = md5Hash("hello world");
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{32}$/);
  });

  test("md5Hash produces different hashes for different input", () => {
    const hash1 = md5Hash("hello");
    const hash2 = md5Hash("world");
    expect(hash1).not.toBe(hash2);
  });
});
