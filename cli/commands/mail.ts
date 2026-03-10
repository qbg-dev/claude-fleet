import type { Command } from "commander";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { FLEET_MAIL_URL, workerDir, resolveProject } from "../lib/paths";
import { fail } from "../lib/fmt";
import { addGlobalOpts } from "../index";

export function register(parent: Command): void {
  const sub = parent
    .command("mail <name>")
    .description("Check worker's Fleet Mail inbox")
    .option("-l, --label <label>", "Filter by label", "UNREAD");
  addGlobalOpts(sub)
    .action(async (name: string, opts: { label: string }, cmd: Command) => {
      const project = cmd.optsWithGlobals().project as string || resolveProject();
      const tokenPath = join(workerDir(project, name), "token");

      if (!existsSync(tokenPath)) fail(`No token for '${name}'`);
      const token = readFileSync(tokenPath, "utf-8").trim();
      if (!token) fail(`Empty token for '${name}'`);

      if (!FLEET_MAIL_URL) fail("Fleet Mail not configured — run: fleet mail-server connect <url>");

      try {
        const resp = await fetch(
          `${FLEET_MAIL_URL}/api/messages?label=${opts.label}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (!resp.ok) {
          fail(`Fleet Mail error: ${resp.status}`);
        }

        const data = await resp.json() as { messages?: Array<{ id: string; from: string; subject: string; date: string }> };
        if (!data.messages?.length) {
          console.log(`No messages with label '${opts.label}'`);
          return;
        }

        for (const msg of data.messages) {
          console.log(JSON.stringify({ id: msg.id, from: msg.from, subject: msg.subject, date: msg.date }, null, 2));
        }
      } catch {
        fail("Fleet Mail unreachable");
      }
    });
}
