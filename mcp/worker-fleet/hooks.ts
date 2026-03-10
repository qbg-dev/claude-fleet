/**
 * Dynamic hooks — unified gate + inject system.
 * Agents register hooks at runtime. Each hook can block (gate) or inject context.
 * Hook scripts read the persisted file and apply matching hooks per event.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { HOME, WORKER_NAME } from "./config";

// ── Types ────────────────────────────────────────────────────────────

// All 18 Claude Code hook events
export type HookEvent =
  | "SessionStart" | "SessionEnd" | "InstructionsLoaded"
  | "UserPromptSubmit"
  | "PreToolUse" | "PermissionRequest" | "PostToolUse" | "PostToolUseFailure"
  | "Notification" | "Stop"
  | "SubagentStart" | "SubagentStop" | "TeammateIdle" | "TaskCompleted"
  | "ConfigChange" | "PreCompact"
  | "WorktreeCreate" | "WorktreeRemove";

export interface DynamicHook {
  id: string;
  event: HookEvent;
  description: string;
  content?: string;              // inject: context text. gate: block reason (falls back to description)
  blocking: boolean;             // true = blocks until completed. false = injects and passes.
  condition?: {
    tool?: string;               // Tool name match (PreToolUse/PostToolUse/PermissionRequest)
    file_glob?: string;          // File path glob
    command_pattern?: string;    // Bash command regex
  };
  completed: boolean;
  completed_at?: string;
  result?: string;
  agent_id?: string;             // Subagent scoping + auto-complete on SubagentStop
  added_at: string;
}

// ── State ────────────────────────────────────────────────────────────

export const dynamicHooks: Map<string, DynamicHook> = new Map();
export let _hookCounter = 0;
export function _incrementHookCounter(): number { return ++_hookCounter; }

const HOOKS_DIR = process.env.CLAUDE_HOOKS_DIR || join(HOME, ".claude/ops/hooks/dynamic");
try { mkdirSync(HOOKS_DIR, { recursive: true }); } catch {}
const HOOKS_FILE = join(HOOKS_DIR, `${WORKER_NAME}.json`);

// ── Persistence ──────────────────────────────────────────────────────

/** Persist hooks to file for hook scripts to read */
export function _persistHooks(): void {
  try {
    const hooks = [...dynamicHooks.values()];
    if (hooks.length === 0) {
      try { rmSync(HOOKS_FILE); } catch {}
      return;
    }
    writeFileSync(HOOKS_FILE, JSON.stringify({ worker: WORKER_NAME, hooks }, null, 2));
  } catch (e) {
    console.error(`[_persistHooks] Failed to write ${HOOKS_FILE}: ${e}`);
  }
}

// On startup, restore from file (survives MCP restart via recycle resume)
try {
  if (existsSync(HOOKS_FILE)) {
    const data = JSON.parse(readFileSync(HOOKS_FILE, "utf-8"));
    if (data.worker === WORKER_NAME && Array.isArray(data.hooks)) {
      for (const h of data.hooks) {
        dynamicHooks.set(h.id, h);
        const num = parseInt(h.id.replace("dh-", ""), 10);
        if (!isNaN(num) && num > _hookCounter) _hookCounter = num;
      }
    }
  }
} catch {}

// ── Helpers ──────────────────────────────────────────────────────────

/** Capture dynamic hooks snapshot for checkpoint */
export function _captureHooksSnapshot(): Array<{ id: string; event: string; description: string; blocking: boolean; completed: boolean }> {
  return [...dynamicHooks.values()].map(h => ({
    id: h.id, event: h.event, description: h.description,
    blocking: h.blocking, completed: h.completed,
  }));
}

/** Summary of pending hooks for display */
export function _pendingHooksSummary(event?: string): string {
  const hooks = [...dynamicHooks.values()];
  const pending = hooks.filter(h => h.blocking && !h.completed && (!event || h.event === event));
  const injects = hooks.filter(h => !h.blocking && (!event || h.event === event));
  const parts: string[] = [];
  if (pending.length > 0) parts.push(`${pending.length} blocking`);
  if (injects.length > 0) parts.push(`${injects.length} inject`);
  return parts.join(", ") || "none";
}
