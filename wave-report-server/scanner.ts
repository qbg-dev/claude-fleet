// scanner.ts — Discovers harnesses, validates progress files, builds registry
// Run: bun run scanner.ts
// Output: registry.json + issues/{harness}.json for each problematic harness

import { readdir, readFile, mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join, resolve } from "path";
import type { ManifestData, ProgressData, Registry, RegistryEntry } from "./types";

const MANIFESTS_DIR = join(process.env.HOME!, ".boring/harness/manifests");
const SERVER_DIR = join(process.env.HOME!, ".boring/wave-report-server");
const REGISTRY_PATH = join(SERVER_DIR, "registry.json");
const ISSUES_DIR = join(SERVER_DIR, "issues");

// Known screenshot directory conventions (checked in order)
const SCREENSHOT_DIRS = [
  "claude_files/screenshots",                // preferred convention
  "src/tests/e2e/screenshots",               // legacy e2e
  "claude_files/html",                       // some reports embed screenshots here
];

export async function scan(): Promise<Registry> {
  await mkdir(ISSUES_DIR, { recursive: true });

  const entries: RegistryEntry[] = [];
  let dirs: string[];

  try {
    dirs = await readdir(MANIFESTS_DIR);
  } catch {
    console.log("[scan] No manifests directory found at", MANIFESTS_DIR);
    return { scanned_at: new Date().toISOString(), entries: [] };
  }

  for (const dir of dirs) {
    // Skip test scaffolds
    if (dir.startsWith("test-scaffold")) continue;

    const manifestPath = join(MANIFESTS_DIR, dir, "manifest.json");
    if (!existsSync(manifestPath)) continue;

    const issues: string[] = [];
    let manifest: ManifestData;

    try {
      manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
    } catch (e) {
      issues.push(`manifest parse error: ${e}`);
      entries.push({
        harness: dir,
        status: "error",
        projectRoot: "",
        progressPath: "",
        screenshotsDir: null,
        tasksDone: 0,
        tasksTotal: 0,
        issues,
      });
      continue;
    }

    const projectRoot = manifest.project_root ?? "";
    const relProgress = manifest.files?.progress ?? "";
    const progressPath = relProgress ? resolve(projectRoot, relProgress) : "";

    // Validate progress file exists
    if (!progressPath || !existsSync(progressPath)) {
      issues.push(`progress file missing: ${progressPath || "(no path in manifest)"}`);
    }

    // Try to parse progress
    let data: ProgressData | null = null;
    if (progressPath && existsSync(progressPath)) {
      try {
        data = JSON.parse(await readFile(progressPath, "utf-8"));
      } catch (e) {
        issues.push(`progress parse error: ${e}`);
      }
    }

    const tasks = data?.tasks ?? {};
    const tasksDone = Object.values(tasks).filter(t => t.status === "completed").length;
    const tasksTotal = Object.keys(tasks).length;

    // Find screenshots directory
    let screenshotsDir: string | null = null;
    if (projectRoot) {
      // Check harness-specific first, then generic
      const harnessScreenshots = join(projectRoot, "claude_files/screenshots", manifest.harness);
      if (existsSync(harnessScreenshots)) {
        screenshotsDir = harnessScreenshots;
      } else {
        for (const candidate of SCREENSHOT_DIRS) {
          const full = join(projectRoot, candidate);
          if (existsSync(full)) {
            screenshotsDir = full;
            break;
          }
        }
      }
    }

    // Check for tasks with screenshot metadata but no screenshots dir
    if (data && !screenshotsDir) {
      const hasScreenshotRefs = Object.values(tasks).some(t => t.metadata?.screenshot);
      if (hasScreenshotRefs) {
        issues.push("tasks reference screenshots but no screenshots directory found");
      }
    }

    // Validate wave task references
    if (data?.waves) {
      for (const wave of data.waves) {
        for (const taskId of wave.tasks ?? []) {
          if (!tasks[taskId]) {
            issues.push(`wave ${wave.id} references missing task: ${taskId}`);
          }
        }
      }
    }

    entries.push({
      harness: manifest.harness,
      status: manifest.status ?? "unknown",
      projectRoot,
      progressPath,
      screenshotsDir,
      tasksDone,
      tasksTotal,
      issues,
    });

    // Write per-harness issues file (agents can check this)
    if (issues.length > 0) {
      await writeFile(
        join(ISSUES_DIR, `${manifest.harness}.json`),
        JSON.stringify({ harness: manifest.harness, scanned_at: new Date().toISOString(), issues }, null, 2)
      );
    } else {
      // Clean up stale issues
      const issuesPath = join(ISSUES_DIR, `${manifest.harness}.json`);
      if (existsSync(issuesPath)) {
        const { unlink } = await import("fs/promises");
        await unlink(issuesPath);
      }
    }
  }

  const registry: Registry = {
    scanned_at: new Date().toISOString(),
    entries,
  };

  await writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2));

  // Summary
  const active = entries.filter(e => e.status === "active").length;
  const withIssues = entries.filter(e => e.issues.length > 0).length;
  console.log(`[scan] ${entries.length} harnesses (${active} active, ${withIssues} with issues)`);
  if (withIssues > 0) {
    console.log(`[scan] Issues written to ${ISSUES_DIR}/`);
    for (const e of entries.filter(e => e.issues.length > 0)) {
      console.log(`  ${e.harness}: ${e.issues.join("; ")}`);
    }
  }

  return registry;
}

// Run as standalone
if (import.meta.main) {
  await scan();
}
