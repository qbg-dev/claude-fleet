import type { Command } from "commander";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { resolveProject } from "../lib/paths";
import { getState } from "../lib/config";
import { sendKeys, sendKeysLiteral, sendEnter, pasteBuffer, listPaneIds, capturePane } from "../lib/tmux";
import { ok, info, warn, fail } from "../lib/fmt";
import { addGlobalOpts } from "../index";

const PANE_MAP_DIR = join(process.env.HOME || "", ".claude/pane-map");

/** Walk PPID chain to find current tmux pane */
function findSelfPane(): string | null {
  const result = Bun.spawnSync(["tmux", "list-panes", "-a", "-F", "#{pane_pid} #{pane_id}"]);
  if (result.exitCode !== 0) return process.env.TMUX_PANE || null;

  const paneMap = new Map<number, string>();
  for (const line of result.stdout.toString().split("\n")) {
    const parts = line.trim().split(" ");
    if (parts.length === 2) paneMap.set(parseInt(parts[0], 10), parts[1]);
  }

  let pid = process.pid;
  while (pid > 1) {
    if (paneMap.has(pid)) return paneMap.get(pid)!;
    const ps = Bun.spawnSync(["ps", "-o", "ppid=", "-p", String(pid)]);
    const ppid = parseInt(ps.stdout.toString().trim(), 10);
    if (isNaN(ppid) || ppid === pid) break;
    pid = ppid;
  }

  return process.env.TMUX_PANE || null;
}

/** Resolve target pane from options */
function resolvePaneId(opts: Record<string, unknown>, project: string): string {
  const livePanes = listPaneIds();

  // 1. Direct pane ID
  if (opts.pane) {
    const paneId = String(opts.pane);
    if (!livePanes.has(paneId)) fail(`Pane ${paneId} no longer exists`);
    return paneId;
  }

  // 2. Worker name → state.json → pane_id
  if (opts.worker) {
    const name = String(opts.worker);
    const state = getState(project, name);
    if (!state) fail(`Worker '${name}' not found in project '${project}'`);
    const paneId = state!.pane_id;
    if (!paneId) { fail(`Worker '${name}' has no active pane (status: ${state!.status})`); return ""; }
    if (!livePanes.has(paneId)) { fail(`Worker '${name}' pane ${paneId} no longer exists`); return ""; }
    return paneId;
  }

  // 3. Session ID → pane-map → pane_id
  if (opts.session) {
    const sid = String(opts.session);
    const mapFile = join(PANE_MAP_DIR, sid);
    if (!existsSync(mapFile)) fail(`Session '${sid}' not found in pane-map`);
    const paneId = readFileSync(mapFile, "utf-8").trim();
    if (!livePanes.has(paneId)) { fail(`Session '${sid}' pane ${paneId} no longer exists`); return ""; }
    return paneId;
  }

  // 4. Self (auto-detect)
  const selfPane = findSelfPane();
  if (!selfPane) fail("Not in a tmux pane and no target specified. Use --pane, --worker, or --session");
  if (!livePanes.has(selfPane)) fail(`Self pane ${selfPane} no longer exists`);
  return selfPane;
}

/** Resolve text to send from options */
function resolveText(text: string | undefined, opts: Record<string, unknown>): string {
  // Convenience shortcuts
  if (opts.effort) return `/effort ${opts.effort}`;
  if (opts.compact) return "/compact";

  // Positional argument
  if (text) return text;

  // Stdin pipe
  if (!process.stdin.isTTY) {
    return readFileSync("/dev/stdin", "utf-8");
  }

  fail("No text to send. Provide text argument, --effort, --compact, or pipe via stdin");
  return ""; // unreachable
}

/** Send text to a pane */
function doSend(paneId: string, text: string, enter: boolean): void {
  if (text.length > 8 * 1024) {
    const success = pasteBuffer(paneId, text);
    if (!success) fail(`Failed to paste buffer to pane ${paneId}`);
  } else {
    sendKeysLiteral(paneId, text);
  }
  if (enter) sendEnter(paneId);
}

/** Interrupt + command + verify + continue */
async function doInterrupt(paneId: string, text: string, continueMsg: string): Promise<void> {
  // Esc (cancel partial input / exit vim insert mode)
  sendKeys(paneId, "Escape");
  await Bun.sleep(150);

  // Ctrl+C (interrupt running response)
  Bun.spawnSync(["tmux", "send-keys", "-t", paneId, "-H", "03"]);
  await Bun.sleep(1500);

  // Send command with verification + retry
  let verified = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    // Ctrl+U (clear line)
    Bun.spawnSync(["tmux", "send-keys", "-t", paneId, "-H", "15"]);
    await Bun.sleep(100);

    // Send slash command + Enter
    sendKeysLiteral(paneId, text);
    sendEnter(paneId);
    await Bun.sleep(1500);

    // Verify: capture pane and check for command execution markers
    const after = capturePane(paneId, 10);
    if (/Set effort|⎿|[Cc]ompact|effort level|Current model|debug/i.test(after)) {
      verified = true;
      info(`Verified '${text}' on attempt ${attempt}`);
      break;
    }

    if (attempt < 3) {
      info(`Attempt ${attempt} not verified, retrying...`);
      await Bun.sleep(1000);
      // Ctrl+C in case the text triggered a response
      Bun.spawnSync(["tmux", "send-keys", "-t", paneId, "-H", "03"]);
      await Bun.sleep(1000);
    }
  }

  if (!verified) warn(`'${text}' sent 3 times but could not verify execution`);

  // Send continue message
  await Bun.sleep(500);
  sendKeysLiteral(paneId, continueMsg);
  sendEnter(paneId);
}

export function register(parent: Command): void {
  const cmd = parent
    .command("send [text]")
    .description("Send text + Enter to a tmux pane (default: self)")
    .option("--pane <id>", "Target pane ID (e.g. %42)")
    .option("-w, --worker <name>", "Target worker by name")
    .option("-s, --session <id>", "Target session by ID")
    .option("--no-enter", "Send text without pressing Enter")
    .option("-r, --repeat <n>", "Repeat N times (for retry patterns)", "1")
    .option("-d, --delay <seconds>", "Delay between repeats in seconds", "2")
    .option("-c, --continue <msg>", "Send this message after all repeats")
    .option("--effort <level>", "Shorthand for /effort <level>")
    .option("--compact", "Shorthand for /compact")
    .option("-i, --interrupt", "Interrupt response first (Esc+Ctrl+C), then send command, verify, continue");
  addGlobalOpts(cmd)
    .action(async (text: string | undefined, _opts: Record<string, unknown>, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals();
      const project = globalOpts.project || resolveProject();
      const paneId = resolvePaneId(globalOpts, project);
      const sendText = resolveText(text, globalOpts);
      const enter = globalOpts.enter !== false;
      const repeat = parseInt(String(globalOpts.repeat || "1"), 10);
      const delay = parseFloat(String(globalOpts.delay || "2"));
      const continueMsg = globalOpts.continue as string | undefined;

      if (globalOpts.interrupt) {
        // Interrupt mode: Ctrl+C, command, verify, continue
        await doInterrupt(paneId, sendText, continueMsg || "Continue.");
      } else if (repeat > 1) {
        for (let i = 0; i < repeat; i++) {
          info(`Send ${i + 1}/${repeat} to ${paneId}`);
          doSend(paneId, sendText, enter);
          if (i < repeat - 1) await Bun.sleep(delay * 1000);
        }
        if (continueMsg) {
          await Bun.sleep(delay * 1000);
          info(`Continue: "${continueMsg}" to ${paneId}`);
          doSend(paneId, continueMsg, true);
        }
      } else {
        doSend(paneId, sendText, enter);
      }

      ok(`Sent to ${paneId}`);
    });
}
