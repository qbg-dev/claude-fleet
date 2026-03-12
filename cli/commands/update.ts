import type { Command } from "commander";
import chalk from "chalk";
import { FLEET_DIR } from "../lib/paths";
import { ok, info, fail } from "../lib/fmt";

export function register(parent: Command): void {
  parent
    .command("update")
    .description("Pull latest fleet code, install deps, re-run setup")
    .action(async () => {
      console.log(`${chalk.bold("fleet update")} — updating fleet infrastructure\n`);

      // 1. git pull
      info("Pulling latest changes...");
      const pull = Bun.spawnSync(["git", "-C", FLEET_DIR, "pull", "origin", "main"], {
        stdout: "inherit",
        stderr: "inherit",
      });
      if (pull.exitCode !== 0) fail("git pull failed");
      ok("Code updated");

      // 2. bun install
      info("Installing dependencies...");
      const install = Bun.spawnSync(["bun", "install"], {
        cwd: FLEET_DIR,
        stdout: "inherit",
        stderr: "inherit",
      });
      if (install.exitCode !== 0) fail("bun install failed");
      ok("Dependencies installed");

      // 3. Re-run fleet setup
      info("Running fleet setup...");
      const setup = Bun.spawnSync(["bun", "run", "cli/index.ts", "setup"], {
        cwd: FLEET_DIR,
        stdout: "inherit",
        stderr: "inherit",
      });
      if (setup.exitCode !== 0) fail("fleet setup failed");

      console.log("");
      ok(chalk.bold("Fleet updated successfully."));
    });
}
