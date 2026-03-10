import type { Command } from "commander";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import chalk from "chalk";
import { FLEET_DIR, FLEET_MAIL_URL } from "../lib/paths";
import { ok, info, fail } from "../lib/fmt";

const HOME = process.env.HOME || "/tmp";
const SETTINGS_FILE = join(HOME, ".claude/settings.json");
const MCP_SCRIPT = join(FLEET_DIR, "mcp/worker-fleet/index.ts");

export function register(parent: Command): void {
  parent
    .command("mcp [action]")
    .description("Manage MCP server registration")
    .option("-q, --quiet", "Suppress output")
    .action((action: string | undefined, opts: { quiet?: boolean }) => {
      const act = action || "status";

      switch (act) {
        case "register": {
          const bunPath = Bun.spawnSync(["which", "bun"]).stdout.toString().trim();
          if (!bunPath) fail("bun not found. Install: curl -fsSL https://bun.sh/install | bash");
          if (!existsSync(MCP_SCRIPT)) fail(`MCP server not found: ${MCP_SCRIPT}`);

          let settings: Record<string, any> = {};
          if (existsSync(SETTINGS_FILE)) {
            try { settings = JSON.parse(readFileSync(SETTINGS_FILE, "utf-8")); } catch {}
          }
          if (!settings.mcpServers) settings.mcpServers = {};
          settings.mcpServers["worker-fleet"] = {
            command: bunPath,
            args: ["run", MCP_SCRIPT],
            env: { FLEET_MAIL_URL },
          };
          writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + "\n");

          if (!opts.quiet) {
            ok("MCP server registered in settings.json");
            console.log(`  command: ${bunPath} run ${MCP_SCRIPT}`);
            console.log("  Restart Claude to pick up the change.");
          }
          break;
        }

        case "unregister": {
          if (existsSync(SETTINGS_FILE)) {
            let settings: Record<string, any> = {};
            try { settings = JSON.parse(readFileSync(SETTINGS_FILE, "utf-8")); } catch {}
            delete settings.mcpServers?.["worker-fleet"];
            writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + "\n");
            ok("MCP server unregistered");
          }
          break;
        }

        case "status": {
          if (existsSync(SETTINGS_FILE)) {
            try {
              const settings = JSON.parse(readFileSync(SETTINGS_FILE, "utf-8"));
              const mcp = settings?.mcpServers?.["worker-fleet"];
              if (mcp) {
                console.log(chalk.green("registered"));
                console.log(JSON.stringify(mcp, null, 2));
                return;
              }
            } catch {}
          }
          console.log(chalk.red("not registered"));
          console.log("  Run: fleet mcp register");
          break;
        }

        case "build": {
          info("Building MCP server...");
          if (!existsSync(MCP_SCRIPT)) fail(`MCP server not found: ${MCP_SCRIPT}`);
          const result = Bun.spawnSync(
            ["bun", "build", "index.ts", "--outfile", "index.js", "--target", "bun"],
            { cwd: dirname(MCP_SCRIPT), stderr: "pipe" },
          );
          if (result.exitCode !== 0) fail("Build failed");
          ok("Built index.js");
          break;
        }

        default:
          fail(`Unknown action '${act}'. Usage: fleet mcp [register|unregister|status|build]`);
      }
    });
}
