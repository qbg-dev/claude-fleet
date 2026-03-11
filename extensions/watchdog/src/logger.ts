/**
 * Watchdog logger — structured JSON to file, human-readable to TTY.
 */

import { appendFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { LOG_FILE } from "./config";
import type { LogEntry } from "./types";

let _logFile = LOG_FILE;
let _quiet = false;

/** Override log file (for testing) */
export function setLogFile(path: string): void { _logFile = path; }

/** Suppress stderr output */
export function setQuiet(quiet: boolean): void { _quiet = quiet; }

function now(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Write a log entry */
export function log(level: LogEntry["level"], event: string, message: string, worker?: string, data?: Record<string, unknown>): void {
  const ts = now();
  const entry: LogEntry = { ts, level, event, message };
  if (worker) entry.worker = worker;
  if (data) entry.data = data;

  // File: structured JSON
  try {
    mkdirSync(dirname(_logFile), { recursive: true });
    appendFileSync(_logFile, JSON.stringify(entry) + "\n");
  } catch {}

  // TTY: human-readable (only when connected to terminal and not quiet)
  if (!_quiet && process.stderr.isTTY) {
    const prefix = level === "error" ? "\x1b[31m" : level === "warn" ? "\x1b[33m" : "\x1b[2m";
    const reset = "\x1b[0m";
    const workerTag = worker ? ` [${worker}]` : "";
    process.stderr.write(`${prefix}[${ts}] ${event}${workerTag}: ${message}${reset}\n`);
  }
}

export const logInfo = (event: string, msg: string, worker?: string, data?: Record<string, unknown>) =>
  log("info", event, msg, worker, data);
export const logWarn = (event: string, msg: string, worker?: string, data?: Record<string, unknown>) =>
  log("warn", event, msg, worker, data);
export const logError = (event: string, msg: string, worker?: string, data?: Record<string, unknown>) =>
  log("error", event, msg, worker, data);
