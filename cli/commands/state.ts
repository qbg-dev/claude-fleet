/**
 * fleet state — Read/write worker state.
 *
 * Subcommands:
 *   fleet state get [name]              Read own state (default) or another worker's. "all" for fleet dashboard.
 *   fleet state set <key> <value>       Persist key-value to registry. --worker <name> for cross-worker.
 *
 * Replaces MCP tools get_worker_state() and update_state().
 */

import type { Command } from "commander";
import {
  readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync,
} from "node:fs";
import { join, basename } from "node:path";
import chalk from "chalk";
import {
  FLEET_DATA, FLEET_MAIL_URL, resolveProject, resolveProjectRoot, workerDir,
} from "../lib/paths";
import { ok, info, fail, table, statusColor } from "../lib/fmt";
import { addGlobalOpts } from "../index";

// ── JSON Helpers ────────────────────────────────────────────────

function readJson<T>(path: string): T | null {
  try { return JSON.parse(readFileSync(path, "utf-8")); } catch { return null; }
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

// ── Path Resolution ─────────────────────────────────────────────

function resolveWorkerName(): string {
  if (process.env.WORKER_NAME) return process.env.WORKER_NAME;
  try {
    const result = Bun.spawnSync(["git", "rev-parse", "--abbrev-ref", "HEAD"], { stderr: "pipe" });
    if (result.exitCode === 0) {
      const branch = result.stdout.toString().trim();
      if (branch.startsWith("worker/")) return branch.slice("worker/".length);
    }
    // Worktree suffix detection
    const dirName = basename(process.cwd());
    const match = dirName.match(/-w-(.+)$/);
    if (match) return match[1];
  } catch {}
  return "operator";
}

// ── Known Top-Level Keys ────────────────────────────────────────

const KNOWN_KEYS = new Set([
  "status", "sleep_duration",
  "last_commit_sha", "last_commit_msg", "last_commit_at",
  "issues_found", "issues_fixed",
  "report_to", "model", "permission_mode", "disallowed_tools",
  "branch", "worktree", "mission_file",
  "pane_id", "pane_target", "tmux_session", "window",
  "session_id", "session_file",
  "bms_token", "forked_from",
]);

const READ_ONLY_KEYS = new Set(["perpetual"]);

// ── Helpers ─────────────────────────────────────────────────────

function parseValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function isPaneAlive(paneId: string): boolean {
  try {
    const result = Bun.spawnSync(["tmux", "has-session", "-t", paneId], { stderr: "pipe" });
    return result.exitCode === 0;
  } catch { return false; }
}

async function getWorkerUnreadCount(project: string, workerName: string): Promise<number> {
  const tokenPath = join(workerDir(project, workerName), "token");
  let token: string;
  try { token = readFileSync(tokenPath, "utf-8").trim(); } catch { return 0; }
  if (!token || !FLEET_MAIL_URL) return 0;
  try {
    const resp = await fetch(
      `${FLEET_MAIL_URL}/api/messages?label=UNREAD&maxResults=1`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(3000) },
    );
    if (!resp.ok) return 0;
    const data = await resp.json() as any;
    return data?._diagnostics?.unread_count ?? data?.messages?.length ?? 0;
  } catch { return 0; }
}

function discoverWorkers(project: string): string[] {
  const projectDir = join(FLEET_DATA, project);
  try {
    return readdirSync(projectDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && !["missions", "_user", "_config"].includes(d.name))
      .filter(d => existsSync(join(projectDir, d.name, "config.json")))
      .map(d => d.name);
  } catch { return []; }
}

function mergeWorkerData(project: string, name: string): Record<string, unknown> | null {
  const dir = workerDir(project, name);
  const state = readJson<Record<string, unknown>>(join(dir, "state.json"));
  const config = readJson<Record<string, unknown>>(join(dir, "config.json"));
  if (!state && !config) return null;

  const merged: Record<string, unknown> = { ...config, ...state };

  // Derive perpetual from sleep_duration
  const sd = merged.sleep_duration;
  merged.perpetual = sd !== null && sd !== undefined && typeof sd === "number" && sd > 0;

  return merged;
}

// ── Subcommands ─────────────────────────────────────────────────

async function stateGet(name: string | undefined, globalOpts: Record<string, unknown>): Promise<void> {
  const projectRoot = resolveProjectRoot();
  const project = (globalOpts.project as string) || resolveProject(projectRoot);
  const json = globalOpts.json as boolean;

  // Default: self
  const targetName = name || resolveWorkerName();

  if (targetName === "all") {
    await stateGetAll(project, json);
    return;
  }

  const data = mergeWorkerData(project, targetName);
  if (!data) return fail(`No state/config found for '${targetName}' in '${project}'`);

  if (json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  // Pretty single-worker output
  console.log(chalk.bold(`Worker: ${targetName}`) + chalk.dim(` (${project})`));
  console.log("");

  const status = String(data.status || "unknown");
  const perpetual = data.perpetual ? "yes" : "no";
  const sleepDuration = data.sleep_duration ?? "null";
  const paneId = data.pane_id ? String(data.pane_id) : "-";
  const paneAlive = data.pane_id ? isPaneAlive(String(data.pane_id)) : false;

  console.log(`  ${chalk.cyan("Status:")}          ${statusColor(status)}`);
  console.log(`  ${chalk.cyan("Perpetual:")}        ${perpetual}`);
  console.log(`  ${chalk.cyan("Sleep Duration:")}   ${sleepDuration}`);
  console.log(`  ${chalk.cyan("Pane:")}             ${paneId}${data.pane_id ? (paneAlive ? chalk.green(" (alive)") : chalk.red(" (dead)")) : ""}`);

  if (data.model) console.log(`  ${chalk.cyan("Model:")}            ${data.model}`);
  if (data.branch) console.log(`  ${chalk.cyan("Branch:")}           ${data.branch}`);
  if (data.window) console.log(`  ${chalk.cyan("Window:")}           ${data.window}`);

  // Last commit
  if (data.last_commit_sha || data.last_commit_msg) {
    console.log("");
    console.log(`  ${chalk.cyan("Last Commit:")}`);
    if (data.last_commit_sha) console.log(`    SHA:  ${String(data.last_commit_sha).slice(0, 10)}`);
    if (data.last_commit_msg) console.log(`    Msg:  ${data.last_commit_msg}`);
    if (data.last_commit_at) console.log(`    At:   ${data.last_commit_at}`);
  }

  // Issues
  const issuesFound = data.issues_found;
  const issuesFixed = data.issues_fixed;
  if (issuesFound !== undefined || issuesFixed !== undefined) {
    console.log("");
    console.log(`  ${chalk.cyan("Issues:")}           found=${issuesFound ?? 0}, fixed=${issuesFixed ?? 0}`);
  }

  // Custom state
  const custom = data.custom as Record<string, unknown> | undefined;
  if (custom && Object.keys(custom).length > 0) {
    console.log("");
    console.log(`  ${chalk.cyan("Custom State:")}`);
    for (const [k, v] of Object.entries(custom)) {
      const display = typeof v === "object" ? JSON.stringify(v) : String(v);
      console.log(`    ${k}: ${display}`);
    }
  }
}

async function stateGetAll(project: string, json: boolean): Promise<void> {
  const workers = discoverWorkers(project);

  if (workers.length === 0) {
    info(`No workers found in '${project}'`);
    return;
  }

  // Gather worker data and unread counts in parallel
  const workerDataList: Array<{
    name: string;
    data: Record<string, unknown>;
    paneAlive: boolean;
    unread: number;
  }> = [];

  const unreadPromises = workers.map(async (name) => {
    const data = mergeWorkerData(project, name);
    if (!data) return null;

    const paneId = data.pane_id ? String(data.pane_id) : null;
    const paneAlive = paneId ? isPaneAlive(paneId) : false;

    // Auto-prune dead panes
    if (data.status === "active" && paneId && !paneAlive) {
      data.status = "dead";
    }

    const unread = await getWorkerUnreadCount(project, name);

    return { name, data, paneAlive, unread };
  });

  const results = await Promise.all(unreadPromises);
  for (const r of results) {
    if (r) workerDataList.push(r);
  }

  if (json) {
    const out: Record<string, unknown> = {};
    for (const w of workerDataList) {
      out[w.name] = { ...w.data, _pane_alive: w.paneAlive, _unread: w.unread };
    }
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  // Pretty fleet dashboard
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(chalk.bold(`=== Fleet Status (${project}) ===`) + chalk.dim(`  ${now}`));
  console.log("");

  // Build table rows
  const rows: string[][] = [];
  const customEntries: Array<{ name: string; custom: Record<string, unknown> }> = [];

  for (const w of workerDataList) {
    const { name, data, paneAlive, unread } = w;
    const status = String(data.status || "unknown");
    const sd = data.sleep_duration;
    const runtime = (sd !== null && sd !== undefined && typeof sd === "number" && sd > 0)
      ? "perpetual" : "one-shot";

    const paneId = data.pane_id ? String(data.pane_id) : "-";
    const paneDisplay = data.pane_id
      ? `${paneId} ${paneAlive ? chalk.green("*") : chalk.red("x")}`
      : "-";

    const inboxDisplay = unread > 0 ? chalk.yellow(String(unread)) : chalk.dim("0");

    // Active task: check custom.active_task or custom.current_task
    const custom = data.custom as Record<string, unknown> | undefined;
    const activeTask = custom?.active_task || custom?.current_task || "-";
    const taskDisplay = typeof activeTask === "string"
      ? activeTask.slice(0, 30)
      : String(activeTask).slice(0, 30);

    rows.push([
      name.slice(0, 22),
      runtime.slice(0, 9),
      statusColor(status),
      paneDisplay,
      inboxDisplay,
      taskDisplay,
    ]);

    // Collect custom state for bottom section
    if (custom && Object.keys(custom).length > 0) {
      customEntries.push({ name, custom });
    }
  }

  table(
    ["Worker", "Runtime", "Status", "Pane", "Inbox", "Active Task"],
    rows,
  );

  // Custom state section
  if (customEntries.length > 0) {
    console.log("");
    console.log(chalk.bold("Custom State"));
    for (const { name, custom } of customEntries) {
      const pairs = Object.entries(custom)
        .filter(([k]) => k !== "active_task" && k !== "current_task")
        .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
        .join(", ");
      if (pairs) {
        console.log(`  ${chalk.cyan(name)}: ${pairs}`);
      }
    }
  }

  // Summary line
  const statusCounts: Record<string, number> = {};
  for (const w of workerDataList) {
    const s = String(w.data.status || "unknown");
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  }
  const summaryParts = Object.entries(statusCounts)
    .map(([s, c]) => `${c} ${s}`)
    .join(", ");
  console.log("");
  console.log(chalk.dim(`${workerDataList.length} workers (${summaryParts})`));
}

async function stateSet(
  key: string, value: string, globalOpts: Record<string, unknown>,
): Promise<void> {
  const projectRoot = resolveProjectRoot();
  const project = (globalOpts.project as string) || resolveProject(projectRoot);
  const workerName = (globalOpts.worker as string) || resolveWorkerName();

  // Block read-only keys
  if (READ_ONLY_KEYS.has(key)) {
    fail(`'${key}' is read-only (derived from sleep_duration)`);
  }

  const dir = workerDir(project, workerName);
  const statePath = join(dir, "state.json");
  const configPath = join(dir, "config.json");

  // Read current files
  const state = readJson<Record<string, unknown>>(statePath) || {};
  const config = readJson<Record<string, unknown>>(configPath) || {};

  if (!existsSync(dir)) {
    fail(`Worker directory not found: ${dir}`);
  }

  const parsed = parseValue(value);

  if (KNOWN_KEYS.has(key)) {
    // Determine which file owns this key
    // Config-owned keys
    const CONFIG_KEYS = new Set([
      "model", "permission_mode", "disallowed_tools",
      "branch", "worktree", "mission_file", "window",
      "sleep_duration", "forked_from",
    ]);

    if (CONFIG_KEYS.has(key)) {
      config[key] = parsed;
      writeJson(configPath, config);
    } else {
      state[key] = parsed;
      writeJson(statePath, state);
    }
  } else {
    // Unknown key → goes into custom object in state.json
    if (!state.custom || typeof state.custom !== "object") {
      state.custom = {};
    }
    (state.custom as Record<string, unknown>)[key] = parsed;
    writeJson(statePath, state);
  }

  ok(`${workerName}: ${key} = ${JSON.stringify(parsed)}`);
}

// ── Registration ────────────────────────────────────────────────

export function register(parent: Command): void {
  const state = parent
    .command("state")
    .description("Read/write worker state");

  // fleet state get [name]
  const get = state
    .command("get [name]")
    .description("Read worker state (default: self, 'all' for fleet dashboard)");
  addGlobalOpts(get)
    .action(async (name: string | undefined, _opts: unknown, cmd: Command) => {
      await stateGet(name, cmd.optsWithGlobals());
    });

  // fleet state set <key> <value>
  const set = state
    .command("set <key> <value>")
    .description("Persist a key-value pair to worker state")
    .option("--worker <name>", "Target worker (default: auto-detect)");
  addGlobalOpts(set)
    .action(async (key: string, value: string, opts: { worker?: string }, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals();
      if (opts.worker) globalOpts.worker = opts.worker;
      await stateSet(key, value, globalOpts);
    });
}
