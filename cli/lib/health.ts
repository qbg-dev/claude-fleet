/**
 * Fleet runtime health checks — 12 checks over all workers.
 * Used by `fleet doctor` for the "Fleet Health" section.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { FLEET_DATA } from "./paths";

// ── Types ──

export interface HealthCheckResult {
  name: string;
  status: "pass" | "fail" | "warn" | "skip";
  message: string;
  fix?: string;
  autoFixable?: boolean;
}

export interface HealthFix {
  check: string;
  action: string;
  fn: () => void;
}

// ── Helpers ──

function readJson<T>(path: string): T | null {
  try { return JSON.parse(readFileSync(path, "utf-8")) as T; } catch { return null; }
}

function tmux(...args: string[]): { ok: boolean; stdout: string } {
  const result = Bun.spawnSync(["tmux", ...args], { stderr: "pipe" });
  return { ok: result.exitCode === 0, stdout: result.stdout.toString().trim() };
}

function listAlivePanes(): Set<string> {
  const { ok, stdout } = tmux("list-panes", "-a", "-F", "#{pane_id}");
  if (!ok) return new Set();
  return new Set(stdout.split("\n").filter(Boolean));
}

function listPaneWindows(): Map<string, string> {
  const { ok, stdout } = tmux("list-panes", "-a", "-F", "#{pane_id}\t#{window_name}");
  if (!ok) return new Map();
  const m = new Map<string, string>();
  for (const line of stdout.split("\n")) {
    const [id, win] = line.split("\t");
    if (id) m.set(id, win || "");
  }
  return m;
}

interface WorkerInfo {
  name: string;
  config: Record<string, any>;
  state: Record<string, any>;
}

function loadAllWorkers(project: string): WorkerInfo[] {
  const projectDir = join(FLEET_DATA, project);
  const workers: WorkerInfo[] = [];
  try {
    for (const d of readdirSync(projectDir, { withFileTypes: true })) {
      if (!d.isDirectory() || d.name.startsWith(".") || d.name.startsWith("_") || d.name === "missions") continue;
      const configPath = join(projectDir, d.name, "config.json");
      const statePath = join(projectDir, d.name, "state.json");
      const config = readJson<Record<string, any>>(configPath);
      if (!config) continue;
      const state = readJson<Record<string, any>>(statePath) || {};
      workers.push({ name: d.name, config, state });
    }
  } catch {}
  return workers;
}

// ── Health Checks ──

export function runHealthChecks(project: string): { results: HealthCheckResult[]; fixes: HealthFix[] } {
  const workers = loadAllWorkers(project);
  if (workers.length === 0) {
    return {
      results: [{ name: "Fleet Health", status: "skip", message: "No workers found" }],
      fixes: [],
    };
  }

  const alivePanes = listAlivePanes();
  const paneWindows = listPaneWindows();
  const results: HealthCheckResult[] = [];
  const fixes: HealthFix[] = [];

  // 1. Pane liveness
  {
    const deadPanes: string[] = [];
    for (const w of workers) {
      const paneId = w.state.pane_id;
      if (paneId && paneId.startsWith("%") && w.state.status === "active" && !alivePanes.has(paneId)) {
        deadPanes.push(w.name);
      }
    }
    if (deadPanes.length > 0) {
      results.push({
        name: "Pane liveness",
        status: "fail",
        message: `${deadPanes.length} active worker(s) with dead panes: ${deadPanes.join(", ")}`,
        autoFixable: true,
      });
      for (const name of deadPanes) {
        fixes.push({
          check: "Pane liveness",
          action: `Clear stale pane_id for ${name}`,
          fn: () => {
            const sp = join(FLEET_DATA, project, name, "state.json");
            const s = readJson<Record<string, any>>(sp);
            if (s) {
              s.pane_id = "";
              s.status = "idle";
              require("fs").writeFileSync(sp, JSON.stringify(s, null, 2) + "\n");
            }
          },
        });
      }
    } else {
      results.push({ name: "Pane liveness", status: "pass", message: "All active workers have live panes" });
    }
  }

  // 2. Invalid pane_ids
  {
    const invalid: string[] = [];
    for (const w of workers) {
      const pid = w.state.pane_id;
      if (pid && !pid.startsWith("%") && pid !== "") {
        invalid.push(`${w.name} (${pid})`);
      }
    }
    if (invalid.length > 0) {
      results.push({
        name: "Invalid pane_ids",
        status: "fail",
        message: `Non-%NNN values: ${invalid.join(", ")}`,
        autoFixable: true,
      });
      for (const w of workers) {
        const pid = w.state.pane_id;
        if (pid && !pid.startsWith("%") && pid !== "") {
          fixes.push({
            check: "Invalid pane_ids",
            action: `Clear invalid pane_id '${pid}' for ${w.name}`,
            fn: () => {
              const sp = join(FLEET_DATA, project, w.name, "state.json");
              const s = readJson<Record<string, any>>(sp);
              if (s) {
                s.pane_id = "";
                require("fs").writeFileSync(sp, JSON.stringify(s, null, 2) + "\n");
              }
            },
          });
        }
      }
    } else {
      results.push({ name: "Invalid pane_ids", status: "pass", message: "All pane_ids valid" });
    }
  }

  // 3. Duplicate panes
  {
    const paneCounts = new Map<string, string[]>();
    for (const w of workers) {
      const pid = w.state.pane_id;
      if (pid && pid.startsWith("%")) {
        const list = paneCounts.get(pid) || [];
        list.push(w.name);
        paneCounts.set(pid, list);
      }
    }
    const dupes = [...paneCounts.entries()].filter(([, names]) => names.length > 1);
    if (dupes.length > 0) {
      const desc = dupes.map(([pid, names]) => `${pid}: ${names.join(", ")}`).join("; ");
      results.push({ name: "Duplicate panes", status: "fail", message: desc });
    } else {
      results.push({ name: "Duplicate panes", status: "pass", message: "No duplicates" });
    }
  }

  // 4. Window placement
  {
    const misplaced: string[] = [];
    for (const w of workers) {
      const pid = w.state.pane_id;
      const targetWin = w.config.window;
      if (pid && pid.startsWith("%") && targetWin && alivePanes.has(pid)) {
        const actualWin = paneWindows.get(pid);
        if (actualWin && actualWin !== targetWin) {
          misplaced.push(`${w.name} (in ${actualWin}, want ${targetWin})`);
        }
      }
    }
    if (misplaced.length > 0) {
      results.push({
        name: "Window placement",
        status: "warn",
        message: `${misplaced.length} misplaced: ${misplaced.join(", ")}`,
        fix: "Watchdog will auto-correct on next pass",
      });
    } else {
      results.push({ name: "Window placement", status: "pass", message: "All panes in correct windows" });
    }
  }

  // 5. Stale sleep_until
  {
    const stale: string[] = [];
    const now = Date.now();
    for (const w of workers) {
      if (w.state.status === "sleeping" && w.state.custom?.sleep_until) {
        const wakeMs = new Date(w.state.custom.sleep_until).getTime();
        if (!isNaN(wakeMs) && wakeMs < now) {
          stale.push(w.name);
        }
      }
    }
    if (stale.length > 0) {
      results.push({
        name: "Stale sleep_until",
        status: "warn",
        message: `${stale.length} sleeping past timer: ${stale.join(", ")}`,
        fix: `Run: fleet start <name>`,
      });
    } else {
      results.push({ name: "Stale sleep_until", status: "pass", message: "No stale timers" });
    }
  }

  // 6. Missing worktrees
  {
    const missing: string[] = [];
    for (const w of workers) {
      const wt = w.config.worktree;
      if (wt && !existsSync(wt)) {
        missing.push(`${w.name} (${wt})`);
      }
    }
    if (missing.length > 0) {
      results.push({ name: "Missing worktrees", status: "fail", message: missing.join(", ") });
    } else {
      results.push({ name: "Missing worktrees", status: "pass", message: "All worktrees exist" });
    }
  }

  // 7. Fleet Mail tokens
  {
    const noToken: string[] = [];
    for (const w of workers) {
      const tokenPath = join(FLEET_DATA, project, w.name, "token");
      if (!existsSync(tokenPath)) {
        noToken.push(w.name);
      } else {
        try {
          const token = readFileSync(tokenPath, "utf-8").trim();
          if (!token) noToken.push(w.name);
        } catch {
          noToken.push(w.name);
        }
      }
    }
    if (noToken.length > 0) {
      results.push({
        name: "Fleet Mail tokens",
        status: "warn",
        message: `${noToken.length} missing: ${noToken.join(", ")}`,
        fix: "Run: fleet setup",
      });
    } else {
      results.push({ name: "Fleet Mail tokens", status: "pass", message: `All ${workers.length} workers have tokens` });
    }
  }

  // 8. Registry drift
  {
    const registryPath = join(FLEET_DATA, project, "registry.json");
    if (existsSync(registryPath)) {
      results.push({
        name: "Registry drift",
        status: "warn",
        message: "Legacy registry.json still exists (per-worker dirs are source of truth)",
        autoFixable: true,
      });
      fixes.push({
        check: "Registry drift",
        action: "Delete stale registry.json",
        fn: () => {
          try { require("fs").unlinkSync(registryPath); } catch {}
        },
      });
    } else {
      results.push({ name: "Registry drift", status: "pass", message: "No legacy registry.json" });
    }
  }

  // 9. Crash loops
  {
    const HOME = process.env.HOME || "/tmp";
    const crashDir = join(HOME, ".tmux-agents/state/watchdog-crashes");
    const crashLooped: string[] = [];
    try {
      for (const f of readdirSync(crashDir)) {
        if (f.endsWith(".crash-loop")) {
          crashLooped.push(f.replace(".crash-loop", ""));
        }
      }
    } catch {}
    if (crashLooped.length > 0) {
      results.push({
        name: "Crash loops",
        status: "fail",
        message: `${crashLooped.length} stuck: ${crashLooped.join(", ")}`,
        autoFixable: true,
      });
      for (const name of crashLooped) {
        fixes.push({
          check: "Crash loops",
          action: `Remove crash-loop flag for ${name}`,
          fn: () => {
            try { require("fs").unlinkSync(join(crashDir, `${name}.crash-loop`)); } catch {}
          },
        });
      }
    } else {
      results.push({ name: "Crash loops", status: "pass", message: "No crash-looped workers" });
    }
  }

  // 10. Liveness staleness
  {
    const HOME = process.env.HOME || "/tmp";
    const runtimeDir = join(HOME, ".tmux-agents/state/watchdog-runtime");
    const staleWorkers: string[] = [];
    const now = Math.floor(Date.now() / 1000);
    for (const w of workers) {
      if (w.state.status !== "active") continue;
      const lf = join(runtimeDir, w.name, "liveness");
      if (!existsSync(lf)) continue;
      try {
        const ts = parseInt(readFileSync(lf, "utf-8").trim(), 10);
        if (!isNaN(ts) && (now - ts) > 1200) {
          staleWorkers.push(`${w.name} (${Math.floor((now - ts) / 60)}min)`);
        }
      } catch {}
    }
    if (staleWorkers.length > 0) {
      results.push({
        name: "Liveness staleness",
        status: "warn",
        message: `${staleWorkers.length} active with stale heartbeat: ${staleWorkers.join(", ")}`,
      });
    } else {
      results.push({ name: "Liveness staleness", status: "pass", message: "All heartbeats recent" });
    }
  }

  // 11. Missing missions
  {
    const noMission: string[] = [];
    for (const w of workers) {
      const mPath = join(FLEET_DATA, project, w.name, "mission.md");
      if (!existsSync(mPath)) noMission.push(w.name);
    }
    if (noMission.length > 0) {
      results.push({
        name: "Missing missions",
        status: "warn",
        message: `${noMission.length} without mission.md: ${noMission.join(", ")}`,
      });
    } else {
      results.push({ name: "Missing missions", status: "pass", message: "All workers have missions" });
    }
  }

  // 12. Watchdog process
  {
    const HOME = process.env.HOME || "/tmp";
    const plistPath = join(HOME, "Library/LaunchAgents/com.tmux-agents.watchdog.plist");
    if (existsSync(plistPath)) {
      const check = Bun.spawnSync(["launchctl", "list", "com.tmux-agents.watchdog"], { stderr: "pipe" });
      if (check.exitCode === 0) {
        results.push({ name: "Watchdog process", status: "pass", message: "Running" });
      } else {
        results.push({
          name: "Watchdog process",
          status: "warn",
          message: "Plist exists but agent not loaded",
          fix: `Run: launchctl load ${plistPath}`,
        });
      }
    } else {
      results.push({
        name: "Watchdog process",
        status: "skip",
        message: "Not installed",
        fix: "Run: bun run extensions/watchdog/src/install.ts",
      });
    }
  }

  return { results, fixes };
}
