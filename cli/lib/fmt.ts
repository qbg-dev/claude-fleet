/**
 * Output formatting: colors, tables, status indicators.
 * Respects NO_COLOR (https://no-color.org/) and FORCE_COLOR env vars.
 */
import chalk from "chalk";

// chalk auto-respects NO_COLOR and FORCE_COLOR, no extra wiring needed.

export const ok = (msg: string) => console.log(`${chalk.green("✓")} ${msg}`);
export const info = (msg: string) => console.log(`${chalk.cyan("→")} ${msg}`);
export const warn = (msg: string) => console.log(`${chalk.yellow("⚠")} ${msg}`);
export const fail = (msg: string): never => {
  console.error(`${chalk.red("ERROR:")} ${msg}`);
  process.exit(1);
};

/** Colorize worker status */
export function statusColor(status: string): string {
  switch (status) {
    case "active":   return chalk.green(status);
    case "sleeping": return chalk.yellow(status);
    case "idle":     return chalk.dim(status);
    case "dead":     return chalk.red(status);
    default:         return chalk.dim(status);
  }
}

/** Print a table with headers and rows */
export function table(headers: string[], rows: string[][]): void {
  // Calculate column widths
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => stripAnsi(r[i] || "").length))
  );

  // Print header
  console.log(headers.map((h, i) => chalk.bold(h.padEnd(widths[i]))).join("  "));
  console.log(widths.map((w) => "─".repeat(w)).join("  "));

  // Print rows
  for (const row of rows) {
    const parts = row.map((cell, i) => {
      const stripped = stripAnsi(cell || "");
      const pad = widths[i] - stripped.length;
      return (cell || "") + " ".repeat(Math.max(0, pad));
    });
    console.log(parts.join("  "));
  }
}

/** Strip ANSI escape codes for width calculation */
function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

/** Suggest running fleet onboard if not yet onboarded */
export function hintOnboard(project: string): void {
  const { existsSync } = require("node:fs");
  const { join } = require("node:path");
  const HOME = process.env.HOME || "/tmp";
  const fleetJsonPath = join(HOME, ".claude/fleet", project, "fleet.json");
  if (!existsSync(fleetJsonPath)) {
    console.log("");
    info(`Tip: Run ${chalk.bold("fleet onboard")} first for guided fleet setup and configuration.`);
  }
}
