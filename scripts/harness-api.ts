#!/usr/bin/env bun
/**
 * harness-api — Local Bun server that serves harness state as JSON.
 * Run: bun run ~/.boring/scripts/harness-api.ts
 * Listens on :7777 with CORS enabled for qbg.dev.
 */

import { readFileSync, readdirSync, existsSync, writeFileSync, renameSync, unlinkSync, appendFileSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";

const PORT = parseInt(process.env.HARNESS_API_PORT || "7777");
const HOME = process.env.HOME || homedir();
const MANIFESTS_DIR = join(HOME, ".boring/harness/manifests");
const STATE_DIR = join(HOME, ".boring/state");
const HEALTH_FILE = process.env.HARNESS_HEALTH_FILE || join(STATE_DIR, "health.json");
const METRICS_FILE = process.env.HARNESS_METRICS_FILE || join(STATE_DIR, "metrics.jsonl");
// sweep-state.json removed — sweeps replaced by custom agent definitions
const SESSION_REGISTRY = join(HOME, ".boring/state/session-registry.json");
// control-plane.pid removed — daemon replaced by custom agent definitions

function readJson(path: string, fallback: any = null): any {
  try {
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return fallback;
  }
}

function readJsonl(path: string, limit: number = 100): any[] {
  try {
    if (!existsSync(path)) return [];
    const lines = readFileSync(path, "utf-8").trim().split("\n");
    return lines.slice(-limit).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

function resolveHarnessDir(name: string): string | null {
  const manifest = readJson(join(MANIFESTS_DIR, name, "manifest.json"));
  if (!manifest?.project_root) return null;
  const progressRel = manifest.files?.progress;
  if (!progressRel) return null;
  // progress is like .claude/harness/{name}/progress.json — go up one level
  return join(manifest.project_root, dirname(progressRel));
}

function readManifests() {
  const results: any[] = [];
  try {
    if (!existsSync(MANIFESTS_DIR)) return results;
    for (const name of readdirSync(MANIFESTS_DIR)) {
      const manifest = readJson(join(MANIFESTS_DIR, name, "manifest.json"));
      if (!manifest) continue;
      let progress: any = null;
      if (manifest.project_root && manifest.files?.progress) {
        progress = readJson(join(manifest.project_root, manifest.files.progress));
      }
      results.push({ name, manifest, progress });
    }
  } catch {}
  return results;
}

// Control plane daemon removed — replaced by custom agent definitions at ~/.claude/agents/

function readMetrics(limit: number): any[] {
  try {
    if (!existsSync(METRICS_FILE)) return [];
    const lines = readFileSync(METRICS_FILE, "utf-8").trim().split("\n");
    return lines.slice(-limit).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

function getLatestIdleSeconds(): Record<string, number> {
  const result: Record<string, number> = {};
  try {
    if (!existsSync(METRICS_FILE)) return result;
    const lines = readFileSync(METRICS_FILE, "utf-8").trim().split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const m = JSON.parse(lines[i]);
        if (m.harness && m.idle_seconds != null && !(m.harness in result)) {
          result[m.harness] = m.idle_seconds;
        }
      } catch {}
    }
  } catch {}
  return result;
}

function getProjectRoots(): string[] {
  const roots = new Set<string>();
  try {
    if (!existsSync(MANIFESTS_DIR)) return [];
    for (const name of readdirSync(MANIFESTS_DIR)) {
      const manifest = readJson(join(MANIFESTS_DIR, name, "manifest.json"));
      if (manifest?.project_root) roots.add(manifest.project_root);
    }
  } catch {}
  return Array.from(roots);
}

function readIssues(): any[] {
  const issues: any[] = [];
  for (const root of getProjectRoots()) {
    const file = join(root, "claude_files/agent-issues.jsonl");
    try {
      if (!existsSync(file)) continue;
      const content = readFileSync(file, "utf-8").trim();
      if (!content) continue;
      for (const line of content.split("\n")) {
        try {
          const issue = JSON.parse(line);
          issue.project_root = root;
          issues.push(issue);
        } catch {}
      }
    } catch {}
  }
  return issues.sort((a, b) => {
    const ta = a.timestamp || a.ts || "";
    const tb = b.timestamp || b.ts || "";
    return tb.localeCompare(ta);
  });
}

function readAgents(): any[] {
  const agents: any[] = [];
  const PANE_REGISTRY = join(STATE_DIR, "pane-registry.json");
  const registry = readJson(PANE_REGISTRY, {});

  for (const [paneId, meta] of Object.entries(registry) as [string, any][]) {
    if (!meta) continue;
    // Compute idle from updated_at
    let idleSeconds: number | null = null;
    if (meta.updated_at) {
      idleSeconds = Math.floor((Date.now() - new Date(meta.updated_at).getTime()) / 1000);
    }
    agents.push({
      pane_id: paneId,
      pane_target: meta.pane_target || null,
      harness: meta.harness || null,
      task: meta.task || null,
      done: meta.done ?? null,
      total: meta.total ?? null,
      display: meta.display || null,
      session_name: meta.session_name || null,
      session_summary: meta.session_summary || null,
      idle_seconds: idleSeconds,
    });
  }

  // Sort by most recently updated
  agents.sort((a, b) => {
    const ia = a.idle_seconds ?? Infinity;
    const ib = b.idle_seconds ?? Infinity;
    return ia - ib;
  });
  return agents;
}

// Sweeps removed — replaced by custom agent definitions at ~/.claude/agents/

function readBeads(): { wisps: any[]; claims: Record<string, any>; gates: Record<string, any> } {
  const allWisps: any[] = [];
  let allClaims: Record<string, any> = {};
  let allGates: Record<string, any> = {};
  for (const root of getProjectRoots()) {
    const file = join(root, "claude_files/harness-beads.json");
    const data = readJson(file);
    if (!data) continue;
    if (Array.isArray(data.wisps)) allWisps.push(...data.wisps);
    if (Array.isArray(data["reconcile-wisps"])) allWisps.push(...data["reconcile-wisps"]);
    if (data.claims && typeof data.claims === "object") Object.assign(allClaims, data.claims);
    if (data.gates && typeof data.gates === "object") Object.assign(allGates, data.gates);
  }
  // Sort wisps by timestamp descending
  allWisps.sort((a, b) => {
    const ta = a.ts || a.timestamp || "";
    const tb = b.ts || b.timestamp || "";
    return tb.localeCompare(ta);
  });
  return { wisps: allWisps, claims: allClaims, gates: allGates };
}

// ── Write helpers ──────────────────────────────────────────────────

function resolveProgressPath(name: string): string | null {
  const manifest = readJson(join(MANIFESTS_DIR, name, "manifest.json"));
  if (!manifest?.project_root || !manifest?.files?.progress) return null;
  const p = join(manifest.project_root, manifest.files.progress);
  return existsSync(p) ? p : null;
}

function writeProgressAtomic(path: string, data: any): void {
  const tmp = path + ".tmp";
  writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
  renameSync(tmp, path);
}

function resolveHarnessPane(name: string): string | null {
  try {
    const tmpFiles = readdirSync("/tmp").filter(f => f.startsWith("tmux_pane_meta_"));
    for (const f of tmpFiles) {
      const meta = readJson(join("/tmp", f));
      if (meta?.harness === name) {
        const paneId = f.replace("tmux_pane_meta_", "");
        // Convert %id to session:window.pane format
        const result = Bun.spawnSync(["tmux", "list-panes", "-a", "-F", "#{pane_id} #{session_name}:#{window_index}.#{pane_index}"]);
        const stdout = result.stdout.toString();
        for (const line of stdout.split("\n")) {
          const parts = line.trim().split(" ");
          if (parts[0] === paneId && parts[1]) return parts[1];
        }
        return paneId;
      }
    }
  } catch {}
  return null;
}

function resolveProjectRoot(name: string): string | null {
  const manifest = readJson(join(MANIFESTS_DIR, name, "manifest.json"));
  return manifest?.project_root || null;
}

function resolveManifestFilePath(name: string, file: string): string | null {
  const manifest = readJson(join(MANIFESTS_DIR, name, "manifest.json"));
  if (!manifest?.project_root || !manifest?.files) return null;
  const rel = manifest.files[file === "harness.md" ? "harness" : file === "policy.json" ? "policy" : null as any];
  if (!rel) return null;
  return join(manifest.project_root, rel);
}

function readSafe(path: string): string | null {
  try {
    if (!existsSync(path)) return null;
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

function errorJson(message: string, status: number = 400): Response {
  return cors(new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  }));
}

function cors(res: Response): Response {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return res;
}

function json(data: any): Response {
  return cors(new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  }));
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return cors(new Response(null, { status: 204 }));
    }

    if (url.pathname === "/" && req.method === "GET") {
      return cors(new Response(null, {
        status: 302,
        headers: { "Location": `/dashboard` },
      }));
    }

    if (url.pathname === "/dashboard") {
      const entries = readManifests();
      const health = readJson(HEALTH_FILE, { harnesses: {} });
      const harnessHealth = health.harnesses || health;

      const idleMap = getLatestIdleSeconds();

      const harnesses = entries.map(({ name, manifest, progress }) => {
        const tasks = progress?.tasks || {};
        const taskList = Object.values(tasks) as any[];
        const completed = taskList.filter(t => t.status === "completed").length;
        const in_progress = taskList.filter(t => t.status === "in_progress").length;
        const pending = taskList.filter(t => t.status === "pending").length;
        const blocked = taskList.filter(t => (t.blockedBy || []).length > 0 && t.status === "pending").length;

        const currentTask = Object.entries(tasks)
          .find(([_, t]: any) => t.status === "in_progress")?.[0]
          || Object.entries(tasks)
          .find(([_, t]: any) => t.status === "pending" && !(t.blockedBy || []).length)?.[0]
          || null;

        const hh = harnessHealth[name] || {};
        const worker = hh.worker || { alive: false, status: "unknown", restarts: 0 };
        const monitor = hh.monitor || { alive: false, status: "unknown" };

        let lastActivity: string | null = null;
        try {
          const actFile = `${STATE_DIR}/activity/claude_activity_${name}.jsonl`;
          if (existsSync(actFile)) {
            const lines = readFileSync(actFile, "utf-8").trim().split("\n");
            const last = JSON.parse(lines[lines.length - 1]);
            lastActivity = last.timestamp || last.ts || null;
          }
        } catch {}

        // Task details for expandable view
        const task_details = Object.entries(tasks).map(([id, t]: [string, any]) => ({
          id,
          status: t.status || "pending",
          description: t.description || "",
          blockedBy: t.blockedBy || [],
          owner: t.owner || null,
          steps: (t.steps || []).length,
          completed_steps: (t.completed_steps || []).length,
        }));

        // Full learnings and commits arrays
        const rawLearnings = progress?.learnings || [];
        const learnings = rawLearnings.map((l: any) =>
          typeof l === "string" ? l : l.text || l.message || JSON.stringify(l)
        );
        const rawCommits = progress?.commits || [];
        const commits = rawCommits.map((c: any) =>
          typeof c === "string" ? c : c.hash ? `${c.hash.slice(0, 7)} ${c.message || ""}`.trim() : JSON.stringify(c)
        );

        // Inbox/outbox counts
        let inbox_unread = 0;
        let outbox_count = 0;
        try {
          const progressRel = manifest.files?.progress;
          if (progressRel && manifest.project_root) {
            const harnessDir = join(manifest.project_root, dirname(progressRel));
            const inboxPath = join(harnessDir, "inbox.jsonl");
            const outboxPath = join(harnessDir, "outbox.jsonl");
            const inboxMsgs = readJsonl(inboxPath, 200);
            inbox_unread = inboxMsgs.filter((m: any) => !m.routed).length;
            outbox_count = readJsonl(outboxPath, 200).length;
          }
        } catch {}

        return {
          name,
          status: progress?.status || manifest.status || "unknown",
          mission: progress?.mission || "",
          project_root: manifest.project_root || "",
          tasks: { total: taskList.length, completed, in_progress, pending, blocked },
          current_task: currentTask,
          worker, monitor, last_activity: lastActivity,
          learnings_count: rawLearnings.length,
          commits_count: rawCommits.length,
          session_count: progress?.session_count || 0,
          task_details,
          learnings,
          commits,
          idle_seconds: idleMap[name] ?? null,
          inbox_unread,
          outbox_count,
        };
      });

      return json({
        harnesses,
        sessions: readJson(SESSION_REGISTRY, {}),
        updated_at: new Date().toISOString(),
      });
    }

    if (url.pathname === "/metrics") {
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);
      const harnessFilter = url.searchParams.get("harness");
      let metrics = readMetrics(limit);
      if (harnessFilter) {
        metrics = metrics.filter((m: any) => m.harness === harnessFilter);
      }
      return json({ metrics, count: metrics.length });
    }

    if (url.pathname === "/health") {
      return json({ ok: true });
    }

    if (url.pathname === "/issues") {
      return json({ issues: readIssues() });
    }

    if (url.pathname === "/agents") {
      return json({ agents: readAgents() });
    }

    if (url.pathname === "/beads") {
      return json(readBeads());
    }

    if (url.pathname === "/sweeps") {
      return json({ status: "removed", message: "Sweeps replaced by custom agent definitions at ~/.claude/agents/" });
    }

    // ── Parameterized routes ──────────────────────────────────────────

    // Extract harness name from /harness/:name/...
    const harnessMatch = url.pathname.match(/^\/harness\/([^/]+)(?:\/(.*))?$/);

    if (harnessMatch) {
      const harnessName = harnessMatch[1];
      const rest = harnessMatch[2] || "";

      // ── Wave 1 ────────────────────────────────────────────────────

      // POST /harness/:name/nudge
      if (rest === "nudge" && req.method === "POST") {
        const body = await req.json().catch(() => null);
        if (!body?.message) return errorJson("message required");
        const pane = resolveHarnessPane(harnessName);
        if (!pane) return errorJson(`No pane found for harness ${harnessName}`, 404);
        const cmd = `tmux send-keys -t ${pane} ${JSON.stringify(body.message)} && tmux send-keys -t ${pane} -H 0d`;
        const proc = Bun.spawnSync(["bash", "-c", cmd]);
        if (proc.exitCode !== 0) return errorJson(`tmux command failed: ${proc.stderr.toString().trim()}`, 500);
        return json({ ok: true, pane });
      }

      // PUT /harness/:name/mission
      if (rest === "mission" && req.method === "PUT") {
        const body = await req.json().catch(() => null);
        if (!body?.mission) return errorJson("mission required");
        const progressPath = resolveProgressPath(harnessName);
        if (!progressPath) return errorJson(`Progress file not found for ${harnessName}`, 404);
        const progress = readJson(progressPath);
        if (!progress) return errorJson("Failed to read progress.json", 500);
        progress.mission = body.mission;
        writeProgressAtomic(progressPath, progress);
        return json({ ok: true });
      }

      // PUT /harness/:name/task/:taskId
      const taskPutMatch = rest.match(/^task\/(.+)$/);
      if (taskPutMatch && req.method === "PUT") {
        const taskId = taskPutMatch[1];
        const body = await req.json().catch(() => null);
        if (!body) return errorJson("Request body required");
        const progressPath = resolveProgressPath(harnessName);
        if (!progressPath) return errorJson(`Progress file not found for ${harnessName}`, 404);
        const progress = readJson(progressPath);
        if (!progress) return errorJson("Failed to read progress.json", 500);
        if (!progress.tasks?.[taskId]) return errorJson(`Task ${taskId} not found`, 404);
        if (body.status !== undefined) progress.tasks[taskId].status = body.status;
        if (body.description !== undefined) progress.tasks[taskId].description = body.description;
        if (body.blockedBy !== undefined) progress.tasks[taskId].blockedBy = body.blockedBy;
        writeProgressAtomic(progressPath, progress);
        return json({ ok: true });
      }

      // POST /harness/:name/task
      if (rest === "task" && req.method === "POST") {
        const body = await req.json().catch(() => null);
        if (!body?.id || !body?.description) return errorJson("id and description required");
        const progressPath = resolveProgressPath(harnessName);
        if (!progressPath) return errorJson(`Progress file not found for ${harnessName}`, 404);
        const progress = readJson(progressPath);
        if (!progress) return errorJson("Failed to read progress.json", 500);
        if (!progress.tasks) progress.tasks = {};
        progress.tasks[body.id] = {
          status: "pending",
          description: body.description,
          blockedBy: body.blockedBy || [],
          owner: null,
          steps: [],
          completed_steps: [],
          team: body.team || null,
          metadata: {},
        };
        writeProgressAtomic(progressPath, progress);
        return json({ ok: true });
      }

      // DELETE /harness/:name/task/:taskId
      const taskDeleteMatch = rest.match(/^task\/(.+)$/);
      if (taskDeleteMatch && req.method === "DELETE") {
        const taskId = taskDeleteMatch[1];
        const progressPath = resolveProgressPath(harnessName);
        if (!progressPath) return errorJson(`Progress file not found for ${harnessName}`, 404);
        const progress = readJson(progressPath);
        if (!progress) return errorJson("Failed to read progress.json", 500);
        if (!progress.tasks?.[taskId]) return errorJson(`Task ${taskId} not found`, 404);
        delete progress.tasks[taskId];
        writeProgressAtomic(progressPath, progress);
        return json({ ok: true });
      }

      // POST /harness/:name/start
      if (rest === "start" && req.method === "POST") {
        const projectRoot = resolveProjectRoot(harnessName);
        if (!projectRoot) return errorJson(`No project root found for ${harnessName}`, 404);
        const cmd = `tmux new-window -d -t h -n ${harnessName} -c ${JSON.stringify(projectRoot)} && sleep 1 && tmux send-keys -t h:${harnessName} "bash .claude/scripts/${harnessName}-start.sh" Enter`;
        const proc = Bun.spawnSync(["bash", "-c", cmd]);
        if (proc.exitCode !== 0) return errorJson(`Failed to start: ${proc.stderr.toString().trim()}`, 500);
        return json({ ok: true });
      }

      // POST /harness/:name/stop
      if (rest === "stop" && req.method === "POST") {
        const pane = resolveHarnessPane(harnessName);
        if (!pane) return errorJson(`No pane found for harness ${harnessName}`, 404);
        const cmd = `tmux send-keys -t ${pane} Escape && sleep 1 && tmux send-keys -t ${pane} "/quit" && tmux send-keys -t ${pane} -H 0d`;
        const proc = Bun.spawnSync(["bash", "-c", cmd]);
        if (proc.exitCode !== 0) return errorJson(`Failed to stop: ${proc.stderr.toString().trim()}`, 500);
        return json({ ok: true });
      }

      // GET /harness/:name/files
      if (rest === "files" && req.method === "GET") {
        const manifest = readJson(join(MANIFESTS_DIR, harnessName, "manifest.json"));
        if (!manifest?.project_root) return errorJson(`Manifest not found for ${harnessName}`, 404);
        const root = manifest.project_root;
        const files = manifest.files || {};
        const harness_md = files.harness ? readSafe(join(root, files.harness)) : null;
        const policy_json = files.policy ? readSafe(join(root, files.policy)) : null;
        const progress_json = files.progress ? readSafe(join(root, files.progress)) : null;
        return json({ harness_md, policy_json, progress_json });
      }

      // PUT /harness/:name/files/:file
      const filePutMatch = rest.match(/^files\/(.+)$/);
      if (filePutMatch && req.method === "PUT") {
        const file = filePutMatch[1];
        if (file !== "harness.md" && file !== "policy.json") {
          return errorJson("Only harness.md and policy.json can be written", 403);
        }
        const body = await req.json().catch(() => null);
        if (!body?.content) return errorJson("content required");
        const filePath = resolveManifestFilePath(harnessName, file);
        if (!filePath) return errorJson(`Cannot resolve path for ${file}`, 404);
        const tmp = filePath + ".tmp";
        writeFileSync(tmp, body.content);
        renameSync(tmp, filePath);
        return json({ ok: true });
      }

      // ── Wave 2 ────────────────────────────────────────────────────

      // GET /harness/:name/activity
      if (rest === "activity" && req.method === "GET") {
        const actFile = `${STATE_DIR}/activity/claude_activity_${harnessName}.jsonl`;
        if (!existsSync(actFile)) return json({ activity: [] });
        try {
          const lines = readFileSync(actFile, "utf-8").trim().split("\n");
          const entries = lines.slice(-100).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
          return json({ activity: entries });
        } catch {
          return json({ activity: [] });
        }
      }

      // ── Wave 3 ────────────────────────────────────────────────────

      // GET /harness/:name/waves
      if (rest === "waves" && req.method === "GET") {
        const progressPath = resolveProgressPath(harnessName);
        if (!progressPath) return errorJson(`Progress file not found for ${harnessName}`, 404);
        const progress = readJson(progressPath);
        if (!progress) return errorJson("Failed to read progress.json", 500);
        return json({
          waves: progress.waves || [],
          cycles_completed: progress.cycles_completed || 0,
          last_cycle_at: progress.last_cycle_at || null,
          lifecycle: progress.lifecycle || "bounded",
        });
      }

      // GET /harness/:name/report/:wave
      const reportMatch = rest.match(/^report\/(\d+)$/);
      if (reportMatch && req.method === "GET") {
        const wave = reportMatch[1];
        const reportPath = join(HOME, `.boring/harness/reports/${harnessName}/wave-${wave}.html`);
        if (!existsSync(reportPath)) return errorJson(`Report wave-${wave} not found for ${harnessName}`, 404);
        const html = readFileSync(reportPath, "utf-8");
        return cors(new Response(html, { headers: { "Content-Type": "text/html" } }));
      }

      // ── Wave 4 ────────────────────────────────────────────────────

      // PUT /harness/:name/status
      if (rest === "status" && req.method === "PUT") {
        const body = await req.json().catch(() => null);
        if (!body?.status) return errorJson("status required");
        const progressPath = resolveProgressPath(harnessName);
        if (!progressPath) return errorJson(`Progress file not found for ${harnessName}`, 404);
        const progress = readJson(progressPath);
        if (!progress) return errorJson("Failed to read progress.json", 500);
        progress.status = body.status;
        writeProgressAtomic(progressPath, progress);
        return json({ ok: true });
      }

      // ── Wave 5: Inbox/Outbox/Message ───────────────────────────────

      // GET /harness/:name/inbox
      if (rest === "inbox" && req.method === "GET") {
        const dir = resolveHarnessDir(harnessName);
        if (!dir) return errorJson(`Harness dir not found for ${harnessName}`, 404);
        const since = url.searchParams.get("since");
        let messages = readJsonl(join(dir, "inbox.jsonl"), 100);
        if (since) {
          messages = messages.filter((m: any) => (m.ts || "") > since);
        }
        return json({ messages });
      }

      // GET /harness/:name/outbox
      if (rest === "outbox" && req.method === "GET") {
        const dir = resolveHarnessDir(harnessName);
        if (!dir) return errorJson(`Harness dir not found for ${harnessName}`, 404);
        let messages = readJsonl(join(dir, "outbox.jsonl"), 100);
        return json({ messages });
      }

      // POST /harness/:name/message
      if (rest === "message" && req.method === "POST") {
        const body = await req.json().catch(() => null);
        if (!body?.content || !body?.type) return errorJson("content and type required");
        const dir = resolveHarnessDir(harnessName);
        if (!dir) return errorJson(`Harness dir not found for ${harnessName}`, 404);
        const msg: any = {
          ts: new Date().toISOString(),
          from: body.from || "dashboard",
          type: body.type,
          content: body.content,
          routed: false,
        };
        if (body.key) msg.key = body.key;
        if (body.task_id) msg.task_id = body.task_id;
        if (body.description) msg.description = body.description;
        const inboxPath = join(dir, "inbox.jsonl");
        appendFileSync(inboxPath, JSON.stringify(msg) + "\n");
        return json({ ok: true, message: msg });
      }
    }

    // ── Non-harness write endpoints ──────────────────────────────────

    // POST /scaffold
    if (url.pathname === "/scaffold" && req.method === "POST") {
      const body = await req.json().catch(() => null);
      if (!body?.name || !body?.project_root) return errorJson("name and project_root required");
      const args = [join(HOME, ".boring/scripts/scaffold.sh"), body.name, body.project_root];
      if (body.lifecycle === "long-running") args.splice(1, 0, "--long-running");
      const proc = Bun.spawnSync(["bash", ...args]);
      const stdout = proc.stdout.toString();
      const stderr = proc.stderr.toString();
      if (proc.exitCode !== 0) return errorJson(`Scaffold failed: ${stderr}`, 500);
      return json({ ok: true, output: stdout + stderr });
    }

    // ── Wave 2: Enhanced /metrics with harness filter ────────────────
    // (handled above in original GET /metrics, enhance it here)

    // ── Control plane endpoints (removed — daemon replaced by ~/.claude/agents/) ──
    if (url.pathname.startsWith("/control-plane/")) {
      return json({ status: "removed", message: "Control plane daemon replaced by custom agent definitions" });
    }

    // ── Event Bus endpoints ─────────────────────────────────────────

    // Project-scoped bus: check all known project roots, fallback to global
    function resolveBusDir(): string {
      for (const root of getProjectRoots()) {
        const projectBus = join(root, ".claude/bus");
        if (existsSync(projectBus)) return projectBus;
      }
      return join(HOME, ".boring/bus");
    }
    const BUS_DIR = resolveBusDir();
    const BUS_TOPICS_DIR = join(BUS_DIR, "topics");
    const BUS_CURSORS_DIR = join(BUS_DIR, "cursors");

    // GET /bus/topics — list all topics with line counts and seq info
    if (url.pathname === "/bus/topics" && req.method === "GET") {
      const topics: any[] = [];
      function scanTopics(dir: string, prefix: string = "") {
        try {
          if (!existsSync(dir)) return;
          for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
              scanTopics(fullPath, prefix ? `${prefix}/${entry.name}` : entry.name);
            } else if (entry.name === "stream.jsonl") {
              const topicName = prefix;
              try {
                const content = readFileSync(fullPath, "utf-8").trim();
                const lineCount = content ? content.split("\n").length : 0;
                const lines = content.split("\n").filter(Boolean);
                const lastEvent = lines.length > 0 ? (() => { try { return JSON.parse(lines[lines.length - 1]); } catch { return null; } })() : null;
                topics.push({
                  topic: topicName,
                  events: lineCount,
                  last_event_ts: lastEvent?._ts || lastEvent?.ts || null,
                  last_event_type: lastEvent?._event_type || null,
                  last_seq: lastEvent?._seq || null,
                });
              } catch {
                topics.push({ topic: topicName, events: 0, last_event_ts: null, last_event_type: null, last_seq: null });
              }
            }
          }
        } catch {}
      }
      scanTopics(BUS_TOPICS_DIR);
      // Also return global seq counter
      const seqFile = join(BUS_DIR, "seq.json");
      const seqData = readJson(seqFile, { global: 0 });
      return json({ topics, global_seq: seqData.global || 0 });
    }

    // GET /bus/stream/:topic — read events from a topic (supports _seq filtering)
    const busStreamMatch = url.pathname.match(/^\/bus\/stream\/(.+)$/);
    if (busStreamMatch && req.method === "GET") {
      const topic = busStreamMatch[1];
      const streamFile = join(BUS_TOPICS_DIR, topic, "stream.jsonl");
      if (!existsSync(streamFile)) return errorJson(`Topic ${topic} not found`, 404);
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 500);
      const since = url.searchParams.get("since");
      const fromFilter = url.searchParams.get("from");
      const afterSeq = url.searchParams.get("after_seq") ? parseInt(url.searchParams.get("after_seq")!) : null;
      let events = readJsonl(streamFile, limit * 2);  // read extra for filtering
      if (afterSeq != null) events = events.filter((e: any) => (e._seq || 0) > afterSeq);
      if (since) events = events.filter((e: any) => (e._ts || e.ts || "") >= since);
      if (fromFilter) events = events.filter((e: any) => (e.from || e.agent) === fromFilter);
      events = events.slice(-limit);
      return json({ topic, events, count: events.length });
    }

    // GET /bus/cursors — show all consumer cursor positions
    if (url.pathname === "/bus/cursors" && req.method === "GET") {
      const cursors: Record<string, any> = {};
      try {
        if (existsSync(BUS_CURSORS_DIR)) {
          for (const f of readdirSync(BUS_CURSORS_DIR)) {
            if (f.endsWith(".json")) {
              const consumer = f.replace(".json", "");
              cursors[consumer] = readJson(join(BUS_CURSORS_DIR, f), {});
            }
          }
        }
      } catch {}
      return json({ cursors });
    }

    // GET /bus/schema — return schema.json
    if (url.pathname === "/bus/schema" && req.method === "GET") {
      const schema = readJson(join(BUS_DIR, "schema.json"), {});
      return json(schema);
    }

    // GET /bus/dlq — read dead letter queue
    if (url.pathname === "/bus/dlq" && req.method === "GET") {
      const dlqFile = join(BUS_DIR, "dlq", "failed.jsonl");
      const events = readJsonl(dlqFile, 100);
      return json({ events, count: events.length });
    }

    return cors(new Response("not found", { status: 404 }));
  },
});

console.log(`harness-api listening on :${PORT}`);
