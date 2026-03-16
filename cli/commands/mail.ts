/**
 * fleet mail — Fleet Mail communication commands.
 *
 * Subcommands:
 *   fleet mail send <to> <subject> [body]   — Send a message
 *   fleet mail inbox [--label UNREAD]        — Read inbox
 *   fleet mail read <id>                     — Read a message by ID
 *   fleet mail help                          — Print API reference
 *
 * Also supports legacy: fleet mail <name> (read a worker's inbox)
 */

import type { Command } from "commander";
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { FLEET_MAIL_URL, FLEET_DATA, workerDir, resolveProject } from "../lib/paths";
import { fail, ok, info } from "../lib/fmt";
import { addGlobalOpts } from "../index";
import { mailRequest, resolveRecipient, cleanDisplayName } from "../lib/mail-client";
import { sanitizeName, resolveIdentity } from "../../shared/identity";

// ── Tmux push notification (best-effort, self-contained) ──────────────

/** Push a tmux overlay + paste to the recipient's pane if they have one. */
function tmuxPushNotify(recipientMailName: string, subject: string, body: string): void {
  try {
    // Extract project from mail name (e.g. "sql-audit@Wechat" → "Wechat")
    // Fall back to resolveProject() (cwd-based) if no @ suffix
    const atIdx = recipientMailName.indexOf("@");
    const project = atIdx >= 0 ? recipientMailName.slice(atIdx + 1) : resolveProject();
    const workerName = atIdx >= 0 ? recipientMailName.slice(0, atIdx) : recipientMailName;

    // Search all project dirs if the extracted project doesn't have this worker
    let fleetDir = join(FLEET_DATA, project);
    let targetWorker: string | null = null;

    if (existsSync(fleetDir)) {
      const workerNames = readdirSync(fleetDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith(".") && !d.name.startsWith("_"))
        .map(d => d.name);
      for (const name of workerNames) {
        if (workerName === name || recipientMailName.includes(name)) { targetWorker = name; break; }
      }
    }

    // Fallback: scan all project dirs for a matching worker name
    if (!targetWorker) {
      const projectDirs = readdirSync(FLEET_DATA, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith("."));
      for (const pd of projectDirs) {
        const candidateDir = join(FLEET_DATA, pd.name);
        try {
          const workers = readdirSync(candidateDir, { withFileTypes: true })
            .filter(d => d.isDirectory() && !d.name.startsWith(".") && !d.name.startsWith("_"))
            .map(d => d.name);
          for (const name of workers) {
            if (recipientMailName.includes(name)) {
              targetWorker = name;
              fleetDir = candidateDir;
              break;
            }
          }
        } catch {}
        if (targetWorker) break;
      }
    }
    if (!targetWorker) return;

    // Read worker's state to get pane_id
    const statePath = join(fleetDir, targetWorker, "state.json");
    if (!existsSync(statePath)) return;
    const state = JSON.parse(readFileSync(statePath, "utf-8"));
    const paneId: string | null = state.pane_id || null;
    if (!paneId) return;

    // Verify pane is alive
    const alive = spawnSync("tmux", ["display-message", "-t", paneId, "-p", "#{pane_id}"], {
      encoding: "utf-8", timeout: 3000,
    });
    if (alive.status !== 0 || alive.stdout.trim() !== paneId) return;

    // Resolve sender name
    const identity = resolveIdentity();
    const senderLabel = identity?.type === "legacy" ? identity.workerName
      : identity?.type === "session" ? identity.identity.customName || "cli"
      : "cli";

    // Fire overlay banner (visible in any TUI state, but transient)
    const preview = `[mail from ${senderLabel}] ${subject}`;
    const displayText = preview.length > 80 ? preview.slice(0, 77) + "..." : preview;
    spawnSync("tmux", ["display-message", "-t", paneId, "-d", "5000", `📬 ${displayText}`], { timeout: 3000 });

    // Also paste the message into the pane's input (persistent delivery, matches MCP behavior).
    // Only paste if pane is idle (at Claude REPL prompt) — don't corrupt in-progress responses.
    const capture = spawnSync("tmux", ["capture-pane", "-t", paneId, "-p"], { encoding: "utf-8", timeout: 3000 });
    const lastLine = (capture.stdout || "").trim().split("\n").filter((l: string) => l.trim()).pop() || "";
    const BUSY = ["(running)"];
    const IDLE = ["bypass permissions", "plan mode on", "ctrl-g to edit", "Context left"];
    const isIdle = !BUSY.some(p => lastLine.includes(p)) && IDLE.some(p => lastLine.includes(p));

    if (isIdle) {
      const pasteText = `[mail from ${senderLabel}] ${subject}: ${body}`;
      const bufName = `cli-push-${Date.now()}`;
      const tmpDir = join(process.env.HOME || "/tmp", ".claude-fleet/tmp");
      if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
      const tmpFile = join(tmpDir, `${bufName}.txt`);
      try {
        writeFileSync(tmpFile, pasteText);
        spawnSync("tmux", ["load-buffer", "-b", bufName, tmpFile], { timeout: 5000 });
        spawnSync("tmux", ["paste-buffer", "-b", bufName, "-t", paneId, "-d"], { timeout: 5000 });
        Bun.sleepSync(500);
        spawnSync("tmux", ["send-keys", "-t", paneId, "-H", "0d"], { timeout: 5000 });
      } finally {
        try { rmSync(tmpFile); } catch {}
        try { spawnSync("tmux", ["delete-buffer", "-b", bufName], { timeout: 2000 }); } catch {}
      }
    }
  } catch {} // best-effort — message already in Fleet Mail
}

export function register(parent: Command): void {
  const mail = parent
    .command("mail")
    .description("Fleet Mail communication");

  // ── fleet mail send ─────────────────────────────────────────────
  const send = mail
    .command("send <to> <subject> [body]")
    .description("Send a message via Fleet Mail");
  addGlobalOpts(send)
    .action(async (to: string, subject: string, body: string | undefined) => {
      if (!FLEET_MAIL_URL) fail("Fleet Mail not configured — run: fleet mail-server connect <url>");

      // Read body from stdin if not provided
      let messageBody = body || "";
      if (!messageBody && !process.stdin.isTTY) {
        messageBody = await readStdin();
      }
      if (!messageBody) messageBody = "(no body)";

      const recipient = await resolveRecipient(to);

      const data = await mailRequest("POST", "/api/messages/send", {
        to: [recipient],
        subject,
        body: messageBody,
      }) as { id: string };

      // Push tmux overlay to recipient (best-effort)
      tmuxPushNotify(recipient, subject, messageBody);

      ok(`Sent to ${cleanDisplayName(recipient)}: "${subject}" (id: ${data.id})`);
    });

  // ── fleet mail inbox ────────────────────────────────────────────
  const inbox = mail
    .command("inbox")
    .description("Read your Fleet Mail inbox")
    .option("-l, --label <label>", "Filter by label", "UNREAD")
    .option("-n, --max <count>", "Max messages", "20");
  addGlobalOpts(inbox)
    .action(async (opts: { label: string; max: string }) => {
      if (!FLEET_MAIL_URL) fail("Fleet Mail not configured — run: fleet mail-server connect <url>");

      const data = await mailRequest("GET", `/api/messages?label=${encodeURIComponent(opts.label)}&maxResults=${encodeURIComponent(opts.max)}`) as {
        messages?: Array<{ id: string; from: any; subject: string; date: string; snippet?: string }>;
      };

      if (!data.messages?.length) {
        info(`No messages with label '${opts.label}'`);
        return;
      }

      for (const msg of data.messages) {
        const from = typeof msg.from === "string" ? msg.from : msg.from?.name || "unknown";
        console.log(JSON.stringify({
          id: msg.id,
          from: cleanDisplayName(from),
          subject: msg.subject,
          date: msg.date,
          ...(msg.snippet ? { snippet: msg.snippet } : {}),
        }, null, 2));
      }
    });

  // ── fleet mail read ─────────────────────────────────────────────
  const read = mail
    .command("read <id>")
    .description("Read a message by ID (auto-marks as read)");
  addGlobalOpts(read)
    .action(async (id: string) => {
      if (!FLEET_MAIL_URL) fail("Fleet Mail not configured — run: fleet mail-server connect <url>");

      const msg = await mailRequest("GET", `/api/messages/${encodeURIComponent(id)}`) as {
        id: string; from: any; to: any[]; subject: string; body: string; date: string;
        labels?: string[]; thread_id?: string;
      };

      const from = typeof msg.from === "string" ? msg.from : msg.from?.name || "unknown";
      console.log(JSON.stringify({
        id: msg.id,
        from: cleanDisplayName(from),
        to: Array.isArray(msg.to) ? msg.to.map((t: any) =>
          cleanDisplayName(typeof t === "string" ? t : t?.name || "unknown")
        ) : msg.to,
        subject: msg.subject,
        date: msg.date,
        labels: msg.labels,
        thread_id: msg.thread_id,
        body: msg.body,
      }, null, 2));
    });

  // ── fleet mail help ─────────────────────────────────────────────
  mail
    .command("help")
    .description("Fleet Mail API reference")
    .action(() => {
      console.log(`Fleet Mail CLI Reference
========================

Send:    fleet mail send <to> "<subject>" "<body>"
         fleet mail send <to> "<subject>" < body.txt
Inbox:   fleet mail inbox [--label UNREAD|INBOX|TASK]
Read:    fleet mail read <id>

Recipient resolution:
  - Full mail name: merger-zPersonalProjects-abc123...
  - Substring match: merger (matches first account containing "merger")
  - Legacy: worker@project format still works

Labels:
  UNREAD, INBOX, SENT, TASK, P1, P2, PENDING, IN_PROGRESS, COMPLETED, BLOCKED

curl examples:
  Search:     curl -H "Authorization: Bearer $TOKEN" "$FLEET_MAIL_URL/api/search?q=from:merger+subject:done"
  Thread:     curl -H "Authorization: Bearer $TOKEN" "$FLEET_MAIL_URL/api/threads/<thread_id>"
  Labels:     curl -H "Authorization: Bearer $TOKEN" -X POST "$FLEET_MAIL_URL/api/messages/<id>/modify" -d '{"addLabelIds":["TASK"]}'
  Directory:  curl -H "Authorization: Bearer $TOKEN" "$FLEET_MAIL_URL/api/directory"
`);
    });

  // ── Legacy: fleet mail <name> (read worker inbox) ───────────────
  // Keep backward compatibility: if first arg doesn't match a subcommand, treat as worker name
  mail
    .argument("[name]", "Worker name (legacy — reads worker inbox)")
    .option("-l, --label <label>", "Filter by label", "UNREAD")
    .action(async (name: string | undefined, opts: { label: string }, cmd: Command) => {
      if (!name) return; // Handled by subcommands
      // Skip if it's a subcommand name
      if (["send", "inbox", "read", "help"].includes(name)) return;

      // Legacy path: read a worker's inbox by name
      const project = cmd.optsWithGlobals().project as string || resolveProject();
      const safeName = sanitizeName(name);
      const tokenPath = join(workerDir(project, safeName), "token");

      if (!existsSync(tokenPath)) fail(`No token for '${name}'`);
      const token = readFileSync(tokenPath, "utf-8").trim();
      if (!token) fail(`Empty token for '${name}'`);
      if (!FLEET_MAIL_URL) fail("Fleet Mail not configured — run: fleet mail-server connect <url>");

      try {
        const resp = await fetch(
          `${FLEET_MAIL_URL}/api/messages?label=${encodeURIComponent(opts.label)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!resp.ok) fail(`Fleet Mail error: ${resp.status}`);
        const data = await resp.json() as { messages?: Array<{ id: string; from: string; subject: string; date: string }> };
        if (!data.messages?.length) {
          console.log(`No messages with label '${opts.label}'`);
          return;
        }
        for (const msg of data.messages) {
          console.log(JSON.stringify(msg, null, 2));
        }
      } catch {
        fail("Fleet Mail unreachable");
      }
    });
}

/** Read all of stdin as a string. */
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8").trim();
}
