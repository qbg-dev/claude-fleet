import type { Command } from "commander";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { FLEET_DATA, FLEET_MAIL_URL, FLEET_MAIL_TOKEN } from "../lib/paths";
import { ok, info, warn, fail } from "../lib/fmt";
import { readJson, writeJson } from "../../shared/io";

const FLEET_SERVER_PATHS = [
  join(process.env.HOME || "", ".cargo/bin/fleet-server"),
];

function findFleetServerBinary(): string | null {
  // Check PATH first
  const which = Bun.spawnSync(["which", "fleet-server"], { stderr: "pipe" });
  if (which.exitCode === 0) return which.stdout.toString().trim();

  // Check known locations
  for (const p of FLEET_SERVER_PATHS) {
    if (existsSync(p)) return p;
  }
  return null;
}

function msDefaultsPath(): string {
  return join(FLEET_DATA, "defaults.json");
}

function updateMailConfig(url: string | null, token: string | null): void {
  const dp = msDefaultsPath();
  const defaults = readJson<Record<string, unknown>>(dp) || {};
  if (url !== undefined) defaults.fleet_mail_url = url;
  if (token !== undefined) defaults.fleet_mail_token = token;
  writeJson(dp, defaults);
}

async function connectAction(args: { url?: string; token?: string }) {
  const url = args.url;
  if (!url) return fail("URL is required: fleet mail-server connect <url> [--token <token>]");

  // Normalize URL — strip trailing slash
  const normalizedUrl = url.replace(/\/+$/, "");

  info(`Connecting to Fleet Mail at ${normalizedUrl}...`);

  // Health check
  try {
    const resp = await fetch(`${normalizedUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) fail(`Server returned ${resp.status}`);
    ok("Server is reachable");
  } catch (e) {
    fail(`Cannot reach ${normalizedUrl} — is the server running?`);
  }

  // Save admin token if provided
  const adminToken = args.token || null;
  if (adminToken) {
    ok("Admin token saved (used for account management)");
  } else {
    info("No admin token provided (worker accounts use per-worker tokens)");
    info("Provide with: fleet mail-server connect <url> --token <token>");
  }

  // Save to defaults.json
  updateMailConfig(normalizedUrl, adminToken);
  ok(`Fleet Mail configured: ${normalizedUrl}`);

  if (adminToken) {
    console.log(`\n  URL:   ${normalizedUrl}`);
    console.log(`  Token: ${adminToken.slice(0, 8)}...${adminToken.slice(-4)}`);
  } else {
    console.log(`\n  URL:   ${normalizedUrl}`);
    console.log(`  Token: ${chalk.dim("not set")}`);
  }

  console.log(`\n  Workers will auto-provision mail accounts on ${chalk.cyan("fleet create")}.`);
}

async function disconnectAction() {
  updateMailConfig(null, null);
  ok("Fleet Mail disconnected — workers will not have mail.");
}

async function statusAction() {
  console.log(chalk.bold("Fleet Mail Status\n"));

  const url = FLEET_MAIL_URL;
  const token = FLEET_MAIL_TOKEN;

  // Config
  if (url) {
    console.log(`  ${chalk.cyan("URL:")}    ${url}`);
  } else {
    console.log(`  ${chalk.cyan("URL:")}    ${chalk.dim("not configured")}`);
    console.log(`\n  Run ${chalk.cyan("fleet mail-server connect <url>")} to configure.`);
    return;
  }

  if (token) {
    console.log(`  ${chalk.cyan("Token:")}  ${token.slice(0, 8)}...${token.slice(-4)}`);
  } else {
    console.log(`  ${chalk.cyan("Token:")}  ${chalk.dim("not set")}`);
  }

  // Source
  if (process.env.FLEET_MAIL_URL) {
    console.log(`  ${chalk.cyan("Source:")} ${chalk.dim("$FLEET_MAIL_URL env var")}`);
  } else {
    console.log(`  ${chalk.cyan("Source:")} ${chalk.dim("defaults.json")}`);
  }

  // Health check
  try {
    const resp = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
    if (resp.ok) {
      console.log(`  ${chalk.cyan("Health:")} ${chalk.green("reachable")}`);
    } else {
      console.log(`  ${chalk.cyan("Health:")} ${chalk.red(`error (${resp.status})`)}`);
    }
  } catch {
    console.log(`  ${chalk.cyan("Health:")} ${chalk.red("unreachable")}`);
  }

}

async function startAction(args: { port?: string; token?: string }) {
  const port = args.port || "8025";
  const binary = findFleetServerBinary();

  if (!binary) {
    return fail(
      "fleet-server binary not found.\n\n" +
      "  Install options:\n" +
      "    1. Build from source:\n" +
      "       git clone https://github.com/qbg-dev/fleet-server.git\n" +
      "       cd fleet-server && cargo build --release\n" +
      "       cp target/release/fleet-server ~/.cargo/bin/\n\n" +
      "    2. Or connect to an existing server:\n" +
      "       fleet mail-server connect http://your-server:8025"
    );
  }

  info(`Found fleet-server at ${binary}`);

  // Check if already running
  try {
    const resp = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (resp.ok) {
      warn(`Server already running on port ${port}`);
      // Save config pointing to it
      const url = `http://127.0.0.1:${port}`;
      const localToken = readLocalAdminToken();
      updateMailConfig(url, localToken);
      ok(`Config updated to ${url}`);
      return;
    }
  } catch {}

  // Generate admin token if not provided and none exists locally
  let adminToken = args.token || null;
  const adminTokenPath = join(process.env.HOME || "", ".fleet-server/admin-token");

  if (!adminToken && existsSync(adminTokenPath)) {
    adminToken = readFileSync(adminTokenPath, "utf-8").trim();
    if (adminToken) info(`Using existing admin token from ~/.fleet-server/admin-token`);
  }

  if (!adminToken) {
    adminToken = crypto.randomUUID();
    // Write it for the server to read
    mkdirSync(join(process.env.HOME || "", ".fleet-server"), { recursive: true });
    writeFileSync(adminTokenPath, adminToken + "\n");
    info(`Generated admin token → ~/.fleet-server/admin-token`);
  }

  // Start the server
  info(`Starting Fleet Mail on port ${port}...`);
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    FLEET_SERVER_BIND: `0.0.0.0:${port}`,
    FLEET_SERVER_ADMIN_TOKEN: adminToken,
  };

  const proc = Bun.spawn([binary, "serve"], {
    env,
    stdout: "pipe",
    stderr: "pipe",
  });

  // Wait for server to be ready (poll health endpoint)
  let ready = false;
  for (let i = 0; i < 20; i++) {
    await Bun.sleep(500);
    try {
      const resp = await fetch(`http://127.0.0.1:${port}/health`, {
        signal: AbortSignal.timeout(1000),
      });
      if (resp.ok) {
        ready = true;
        break;
      }
    } catch {}
  }

  if (!ready) {
    proc.kill();
    fail("Server failed to start within 10s");
  }

  const url = `http://127.0.0.1:${port}`;
  updateMailConfig(url, adminToken);

  ok(`Fleet Mail running at ${url} (PID: ${proc.pid})`);
  console.log(`\n  URL:   ${url}`);
  console.log(`  Token: ${adminToken.slice(0, 8)}...${adminToken.slice(-4)}`);
  console.log(`  PID:   ${proc.pid}`);
  console.log(`\n  Stop:  kill ${proc.pid}`);
  console.log(`  The server runs in the background.`);

  // Detach — don't wait for the process
  proc.unref();
}

function readLocalAdminToken(): string | null {
  const p = join(process.env.HOME || "", ".fleet-server/admin-token");
  if (!existsSync(p)) return null;
  const t = readFileSync(p, "utf-8").trim();
  return t || null;
}

export function register(parent: Command): void {
  parent
    .command("mail-server [action] [url]")
    .description("Fleet Mail server management")
    .option("-t, --token <token>", "Admin token")
    .option("--port <port>", "Port for local server", "8025")
    .action(async (action: string | undefined, url: string | undefined, opts: { token?: string; port?: string }) => {
      const act = action || "status";

      switch (act) {
        case "connect":
          return connectAction({ url, token: opts.token });
        case "disconnect":
          return disconnectAction();
        case "status":
          return statusAction();
        case "start":
          return startAction({ port: opts.port, token: opts.token });
        default:
          fail(`Unknown action: ${act}\n\nUsage:\n  fleet mail-server connect <url> [--token <token>]\n  fleet mail-server disconnect\n  fleet mail-server status\n  fleet mail-server start [--port 8025]`);
      }
    });
}
