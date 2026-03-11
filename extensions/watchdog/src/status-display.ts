/**
 * Status table display for --status mode.
 */

import type { WorkerSnapshot } from "./types";
import { isCrashLooped } from "./crash-tracker";
import { listAlivePanes } from "./pane-manager";
import { RUNTIME_DIR } from "./config";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export function printStatus(snapshots: WorkerSnapshot[]): void {
  const alivePanes = listAlivePanes();
  const now = Math.floor(Date.now() / 1000);

  const headers = ["WORKER", "PANE", "WINDOW", "STATE", "IDLE"];
  const rows: string[][] = [];

  for (const snap of snapshots) {
    const paneId = snap.paneId || "-";
    const window = snap.window || "-";

    let state = "no-pane";
    let idleStr = "-";

    if (snap.paneId && alivePanes.has(snap.paneId)) {
      state = "alive";
      const marker = join(RUNTIME_DIR, snap.name, "stuck-candidate");
      if (existsSync(marker)) {
        try {
          const since = parseInt(readFileSync(marker, "utf-8").trim(), 10);
          if (!isNaN(since)) idleStr = `${now - since}s`;
        } catch {}
      }
    } else if (snap.paneId) {
      state = "dead";
    }

    if (isCrashLooped(snap.name)) state = "CRASH-LOOP";
    if (snap.status === "standby") state = "standby";
    if (snap.status === "sleeping") state = "sleeping";
    if (snap.perpetual) state += "+perp";

    rows.push([snap.name, paneId, window, state, idleStr]);
  }

  // Print table
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => (r[i] || "").length)),
  );

  console.log(headers.map((h, i) => h.padEnd(widths[i])).join("  "));
  console.log(widths.map(w => "-".repeat(w)).join("  "));
  for (const row of rows) {
    console.log(row.map((c, i) => (c || "").padEnd(widths[i])).join("  "));
  }
}
