/**
 * fleet mail — Fleet Mail CLI with self-service and operator subcommands.
 *
 * Self-service (auto-detected from WORKER_NAME / branch / worktree):
 *   fleet mail inbox [--label UNREAD]         Read own inbox
 *   fleet mail send <to> "<subject>" "<body>" [--cc ...] [--in-reply-to ...] [--labels ...]
 *   fleet mail read <id>                      Read full message, auto-mark read
 *
 * Operator:
 *   fleet mail check <name> [--label UNREAD]  Check another worker's inbox
 */

import type { Command } from "commander";
import { readFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { FLEET_MAIL_URL, FLEET_DATA, workerDir, resolveProject } from "../lib/paths";
import { ok, info, fail } from "../lib/fmt";
import { addGlobalOpts } from "../index";

// ── Path Resolution ─────────────────────────────────────────────

function resolveWorkerName(): string {
  if (process.env.WORKER_NAME) return process.env.WORKER_NAME;
  try {
    const result = Bun.spawnSync(["git", "rev-parse", "--abbrev-ref", "HEAD"], { stderr: "pipe" });
    if (result.exitCode === 0) {
      const branch = result.stdout.toString().trim();
      if (branch.startsWith("worker/")) return branch.slice("worker/".length);
    }
    const dirName = basename(process.cwd());
    const match = dirName.match(/-w-(.+)$/);
    if (match) return match[1];
  } catch {}
  return "operator";
}

// ── Helpers ─────────────────────────────────────────────────────

function requireMailUrl(): string {
  if (!FLEET_MAIL_URL) fail("Fleet Mail not configured — run: fleet mail-server connect <url>");
  return FLEET_MAIL_URL!;
}

function getToken(project: string, workerName: string): string {
  const tokenPath = join(workerDir(project, workerName), "token");
  if (!existsSync(tokenPath)) fail(`No token for '${workerName}' — run: fleet create or fleet mail-server connect`);
  const token = readFileSync(tokenPath, "utf-8").trim();
  if (!token) fail(`Empty token for '${workerName}'`);
  return token;
}

function mailAccountName(localName: string, project: string): string {
  if (localName.includes("@") || localName.startsWith("list:")) return localName;
  return `${localName}@${project.toLowerCase()}`;
}

function stripMailNamespace(name: string, project: string): string {
  const suffix = `@${project.toLowerCase()}`;
  if (name.endsWith(suffix)) return name.slice(0, -suffix.length);
  return name;
}

function cleanResponse(data: any, project: string): any {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data)) return data.map((d: any) => cleanResponse(d, project));
  const out: any = { ...data };
  if (typeof out.from === "string") out.from = stripMailNamespace(out.from, project);
  if (out.from?.name) out.from = { ...out.from, name: stripMailNamespace(out.from.name, project) };
  if (Array.isArray(out.to)) out.to = out.to.map((t: any) =>
    typeof t === "string" ? stripMailNamespace(t, project) : t?.name ? { ...t, name: stripMailNamespace(t.name, project) } : t);
  if (Array.isArray(out.cc)) out.cc = out.cc.map((t: any) =>
    typeof t === "string" ? stripMailNamespace(t, project) : t?.name ? { ...t, name: stripMailNamespace(t.name, project) } : t);
  if (Array.isArray(out.messages)) out.messages = out.messages.map((m: any) => cleanResponse(m, project));
  return out;
}

// ── Subcommands ─────────────────────────────────────────────────

/** fleet mail inbox [--label UNREAD] — read own inbox */
async function mailInbox(opts: { label: string }, globalOpts: Record<string, unknown>): Promise<void> {
  const url = requireMailUrl();
  const project = (globalOpts.project as string) || resolveProject();
  const workerName = resolveWorkerName();
  const token = getToken(project, workerName);

  try {
    const resp = await fetch(
      `${url}/api/messages?label=${opts.label}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) },
    );
    if (!resp.ok) fail(`Fleet Mail error: ${resp.status}`);

    const data = await resp.json() as any;
    const cleaned = cleanResponse(data, project);

    if (!cleaned.messages?.length) {
      info(`No messages with label '${opts.label}'`);
      return;
    }

    for (const msg of cleaned.messages) {
      console.log(JSON.stringify({
        id: msg.id, from: msg.from, subject: msg.subject, date: msg.date,
        ...(msg.labels ? { labels: msg.labels } : {}),
      }, null, 2));
    }
  } catch (e: any) {
    if (e.message?.includes("Fleet Mail")) throw e;
    fail("Fleet Mail unreachable");
  }
}

/** fleet mail send <to> "<subject>" "<body>" */
async function mailSend(
  to: string, subject: string, body: string,
  opts: { cc?: string[]; inReplyTo?: string; labels?: string[]; threadId?: string },
  globalOpts: Record<string, unknown>,
): Promise<void> {
  const url = requireMailUrl();
  const project = (globalOpts.project as string) || resolveProject();
  const workerName = resolveWorkerName();
  const token = getToken(project, workerName);

  // Namespace recipient names
  const toNames = to.split(",").map(n => mailAccountName(n.trim(), project));
  const ccNames = (opts.cc || []).map(n => mailAccountName(n.trim(), project));

  const payload: Record<string, unknown> = {
    to: toNames,
    subject,
    body,
  };
  if (ccNames.length > 0) payload.cc = ccNames;
  if (opts.inReplyTo) payload.in_reply_to = opts.inReplyTo;
  if (opts.labels?.length) payload.labels = opts.labels;
  if (opts.threadId) payload.thread_id = opts.threadId;

  try {
    const resp = await fetch(`${url}/api/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      fail(`Send failed (${resp.status}): ${text.slice(0, 200)}`);
    }

    const data = await resp.json() as any;
    ok(`Sent to ${to}: "${subject}" (id: ${data.id || "?"})`);

    // Best-effort tmux overlay delivery
    try {
      const recipientNames = to.split(",").map(n => n.trim());
      for (const name of recipientNames) {
        const stateFile = join(FLEET_DATA, project, name, "state.json");
        if (!existsSync(stateFile)) continue;
        const state = JSON.parse(readFileSync(stateFile, "utf-8"));
        const paneId = state.pane_id;
        if (!paneId) continue;
        // Check pane alive
        const check = Bun.spawnSync(["tmux", "has-session", "-t", paneId], { stderr: "pipe" });
        if (check.exitCode !== 0) continue;
        // Display overlay
        Bun.spawnSync([
          "tmux", "display-message", "-t", paneId, "-d", "3000",
          `📬 Mail from ${workerName}: ${subject}`,
        ], { stderr: "pipe" });
      }
    } catch {}
  } catch (e: any) {
    if (e.message?.includes("Send failed")) throw e;
    fail("Fleet Mail unreachable");
  }
}

/** fleet mail read <id> — read full message, auto-mark read */
async function mailRead(id: string, globalOpts: Record<string, unknown>): Promise<void> {
  const url = requireMailUrl();
  const project = (globalOpts.project as string) || resolveProject();
  const workerName = resolveWorkerName();
  const token = getToken(project, workerName);

  try {
    const resp = await fetch(
      `${url}/api/messages/${id}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) },
    );
    if (!resp.ok) fail(`Fleet Mail error: ${resp.status}`);

    const data = await resp.json() as any;
    const cleaned = cleanResponse(data, project);
    console.log(JSON.stringify(cleaned, null, 2));

    // Auto-mark as read (best-effort)
    try {
      await fetch(`${url}/api/messages/${id}/modify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
        signal: AbortSignal.timeout(5_000),
      });
    } catch {}
  } catch (e: any) {
    if (e.message?.includes("Fleet Mail")) throw e;
    fail("Fleet Mail unreachable");
  }
}

/** fleet mail check <name> [--label UNREAD] — operator: check another worker's inbox */
async function mailCheck(name: string, opts: { label: string }, globalOpts: Record<string, unknown>): Promise<void> {
  const url = requireMailUrl();
  const project = (globalOpts.project as string) || resolveProject();
  const token = getToken(project, name);

  try {
    const resp = await fetch(
      `${url}/api/messages?label=${opts.label}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) },
    );
    if (!resp.ok) fail(`Fleet Mail error: ${resp.status}`);

    const data = await resp.json() as any;
    const cleaned = cleanResponse(data, project);

    if (!cleaned.messages?.length) {
      info(`No messages for '${name}' with label '${opts.label}'`);
      return;
    }

    for (const msg of cleaned.messages) {
      console.log(JSON.stringify({
        id: msg.id, from: msg.from, subject: msg.subject, date: msg.date,
      }, null, 2));
    }
  } catch (e: any) {
    if (e.message?.includes("Fleet Mail")) throw e;
    fail("Fleet Mail unreachable");
  }
}

// ── Registration ────────────────────────────────────────────────

export function register(parent: Command): void {
  const mail = parent
    .command("mail")
    .description("Fleet Mail — send, read, and check messages");

  // fleet mail inbox [--label UNREAD]
  const inbox = mail
    .command("inbox")
    .description("Read your own inbox")
    .option("-l, --label <label>", "Filter by label", "UNREAD");
  addGlobalOpts(inbox)
    .action(async (opts: { label: string }, cmd: Command) => {
      await mailInbox(opts, cmd.optsWithGlobals());
    });

  // fleet mail send <to> <subject> <body>
  const send = mail
    .command("send <to> <subject> <body>")
    .description("Send a message to a worker, 'user', 'all', or mailing list")
    .option("--cc <names...>", "CC recipients")
    .option("--in-reply-to <id>", "Reply to a message ID")
    .option("--labels <labels...>", "Labels to apply")
    .option("--thread-id <id>", "Thread ID for grouping");
  addGlobalOpts(send)
    .action(async (to: string, subject: string, body: string,
      opts: { cc?: string[]; inReplyTo?: string; labels?: string[]; threadId?: string },
      cmd: Command,
    ) => {
      await mailSend(to, subject, body, opts, cmd.optsWithGlobals());
    });

  // fleet mail read <id>
  const read = mail
    .command("read <id>")
    .description("Read a full message by ID (auto-marks as read)");
  addGlobalOpts(read)
    .action(async (id: string, _opts: unknown, cmd: Command) => {
      await mailRead(id, cmd.optsWithGlobals());
    });

  // fleet mail check <name> — operator command (existing functionality, renamed)
  const check = mail
    .command("check <name>")
    .description("Check another worker's inbox (operator)")
    .option("-l, --label <label>", "Filter by label", "UNREAD");
  addGlobalOpts(check)
    .action(async (name: string, opts: { label: string }, cmd: Command) => {
      await mailCheck(name, opts, cmd.optsWithGlobals());
    });
}
