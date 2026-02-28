// server.ts — Bun HTTP server for wave reports
// Usage: bun run server.ts [--port 3847] [--scan]

import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { renderReport, renderIndex } from "./renderer";
import { scan } from "./scanner";
import type { Registry, RegistryEntry, ProgressData } from "./types";

const PORT = parseInt(process.argv.find((_, i, a) => a[i - 1] === "--port") ?? "3847");
const SERVER_DIR = join(process.env.HOME!, ".claude-ops/wave-report-server");
const REGISTRY_PATH = join(SERVER_DIR, "registry.json");

// Initial scan on startup
console.log("[server] Scanning harnesses...");
let registry = await scan();
console.log(`[server] Found ${registry.entries.length} harnesses`);

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // ── Index ──
    if (path === "/" || path === "/index") {
      // Re-scan on each index load for freshness (fast, <50ms)
      registry = await scan();
      return html(renderIndex(registry.entries));
    }

    // ── Report ──
    const reportMatch = path.match(/^\/report\/([^/]+)$/);
    if (reportMatch) {
      const harnessName = decodeURIComponent(reportMatch[1]);
      const entry = registry.entries.find(e => e.harness === harnessName);
      if (!entry) return notFound(`Harness "${harnessName}" not found in registry. Run scan.sh or reload the index.`);

      // Read progress.json fresh each time
      if (!entry.progressPath || !existsSync(entry.progressPath)) {
        return notFound(`Progress file not found: ${entry.progressPath}`);
      }

      let data: ProgressData;
      try {
        data = JSON.parse(await readFile(entry.progressPath, "utf-8"));
      } catch (e) {
        return errorResp(`Failed to parse progress.json: ${e}`);
      }

      return html(renderReport(data, entry));
    }

    // ── Screenshots ──
    const ssMatch = path.match(/^\/screenshots\/([^/]+)\/(.+)$/);
    if (ssMatch) {
      const harnessName = decodeURIComponent(ssMatch[1]);
      const filePath = decodeURIComponent(ssMatch[2]);
      const entry = registry.entries.find(e => e.harness === harnessName);
      if (!entry) return notFound("Harness not found");

      // Try multiple resolution strategies
      const candidates: string[] = [];
      if (entry.screenshotsDir) candidates.push(join(entry.screenshotsDir, filePath));
      if (entry.projectRoot) {
        candidates.push(join(entry.projectRoot, filePath));
        candidates.push(join(entry.projectRoot, "claude_files/screenshots", filePath));
        candidates.push(join(entry.projectRoot, "claude_files/screenshots", harnessName, filePath));
      }

      for (const candidate of candidates) {
        if (existsSync(candidate)) {
          const file = Bun.file(candidate);
          return new Response(file, {
            headers: { "Content-Type": file.type || "image/png", "Cache-Control": "max-age=60" },
          });
        }
      }

      return notFound(`Screenshot not found: ${filePath}`);
    }

    // ── API: Re-scan ──
    if (path === "/api/scan" && req.method === "POST") {
      registry = await scan();
      return json({ ok: true, entries: registry.entries.length, scanned_at: registry.scanned_at });
    }

    // ── API: Registry ──
    if (path === "/api/registry") {
      return json(registry);
    }

    // ── API: Issues for a specific harness (agents poll this) ──
    const issuesMatch = path.match(/^\/api\/issues\/([^/]+)$/);
    if (issuesMatch) {
      const harnessName = decodeURIComponent(issuesMatch[1]);
      const issuesPath = join(SERVER_DIR, "issues", `${harnessName}.json`);
      if (existsSync(issuesPath)) {
        return new Response(Bun.file(issuesPath), { headers: { "Content-Type": "application/json" } });
      }
      return json({ harness: harnessName, issues: [] });
    }

    return notFound("Not found");
  },
});

console.log(`[server] Wave Report Server running at http://localhost:${server.port}`);

function html(body: string): Response {
  return new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
function json(data: any): Response {
  return new Response(JSON.stringify(data, null, 2), { headers: { "Content-Type": "application/json" } });
}
function notFound(msg: string): Response {
  return new Response(msg, { status: 404, headers: { "Content-Type": "text/plain" } });
}
function errorResp(msg: string): Response {
  return new Response(msg, { status: 500, headers: { "Content-Type": "text/plain" } });
}
