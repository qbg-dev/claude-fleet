/**
 * fleet deep-review — Multi-pass adversarial code review pipeline.
 *
 * Delegates to the program-API pipeline system.
 * Declarative pipeline in programs/deep-review.program.ts, compiled
 * into hooks/seeds/wrappers by engine/program/.
 */
import type { Command } from "commander";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { addGlobalOpts } from "../index";
import { fail } from "../lib/fmt";
import { runPipeline } from "./pipeline";

const HOME = process.env.HOME || "/tmp";

export function register(program: Command): void {
  const cmd = program
    .command("deep-review")
    .alias("dr")
    .description("Launch a multi-pass deep review pipeline")
    .option("--scope <scope>", "Git diff scope (branch, SHA, uncommitted, pr:N, HEAD, codebase)")
    .option("--content <files>", "File path(s) to review, comma-separated")
    .option("--spec <text>", "What to review for (guides all workers)")
    .option("--passes <n>", "Passes per focus area (default: 2)", "2")
    .option("--session-name <name>", "Custom tmux session name")
    .option("--notify <target>", "Notify on completion (worker name or 'user')")
    .option("--focus <list>", "Comma-separated focus areas (overrides auto-detect)")
    .option("--no-judge", "Skip adversarial judge validation")
    .option("--no-context", "Skip context pre-pass (static analysis, deps)")
    .option("--force", "Force review even if auto-skip would trigger")
    .option("--verify", "Enable verification phase after review")
    .option("--verify-roles <list>", "Comma-separated user roles to test as")
    .option("--max-workers <n>", "Max worker budget for role designer")
    .option("--no-worktree", "Skip worktree isolation")
    .option("--no-improve-review", "Skip REVIEW.md improvement phase")
    .option("--dry-run", "Print manifest without launching")
    .action(async (opts: Record<string, any>) => {
      try {
        await runDeepReview(opts);
      } catch (e: any) {
        fail(e.message || String(e));
      }
    });

  addGlobalOpts(cmd);
}

async function runDeepReview(opts: Record<string, any>): Promise<void> {
  // Ensure dr-context binary is signed (macOS)
  const claudeOps = process.env.CLAUDE_FLEET_DIR || join(HOME, ".claude-fleet");
  const drContextBin = join(claudeOps, "bin", "dr-context");
  if (existsSync(drContextBin)) {
    const verify = (Bun.spawnSync as any)(["codesign", "-v", drContextBin], { stderr: "pipe" });
    if (verify.exitCode !== 0) {
      (Bun.spawnSync as any)(["codesign", "-s", "-", drContextBin], { stderr: "pipe" });
    }
  }

  await runPipeline("deep-review", opts);
}
