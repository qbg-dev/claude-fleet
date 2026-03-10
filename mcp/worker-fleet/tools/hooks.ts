/**
 * Hook tools — add_hook, complete_hook, remove_hook, list_hooks
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFileSync } from "fs";
import { join } from "path";
import { CLAUDE_OPS } from "../config";
import { dynamicHooks, _incrementHookCounter, _persistHooks, _pendingHooksSummary, type DynamicHook } from "../hooks";

export function registerHookTools(server: McpServer): void {

server.registerTool(
  "add_hook",
  {
    description: "Register a dynamic hook that fires on a hook event. Can block the event (gate) or inject context. Use for self-governance: add verification gates before recycling, inject guidance before tool calls, or block specific tool usage until conditions are met. Hook scripts read these at runtime.",
    inputSchema: {
      event: z.enum([
        "SessionStart", "SessionEnd", "InstructionsLoaded",
        "UserPromptSubmit",
        "PreToolUse", "PermissionRequest", "PostToolUse", "PostToolUseFailure",
        "Notification", "Stop",
        "SubagentStart", "SubagentStop", "TeammateIdle", "TaskCompleted",
        "ConfigChange", "PreCompact",
        "WorktreeCreate", "WorktreeRemove",
      ]).describe("Which hook event to fire on. Common: Stop (blocks session exit), PreToolUse (fires before tool call), PreCompact (before context compaction), SubagentStop (when subagent finishes)"),
      description: z.string().describe("Human-readable purpose (e.g. 'verify build passes', 'ontology guidance')"),
      blocking: z.boolean().optional().describe("If true (default for Stop), blocks the event until complete_hook(id) is called. If false (default for PreToolUse), injects content as context and passes through"),
      content: z.string().optional().describe("For inject hooks: context text to add. For blocking hooks: block reason shown to agent. Falls back to description if omitted"),
      condition: z.object({
        tool: z.string().optional().describe("Only fire when this tool is called (e.g. 'Bash', 'Edit', 'Write')"),
        file_glob: z.string().optional().describe("Only fire when file path matches glob (e.g. 'src/ontology/**')"),
        command_pattern: z.string().optional().describe("Only fire when Bash command matches regex (e.g. 'git push.*')"),
      }).optional().describe("Condition for when this hook fires (PreToolUse only). Omit for unconditional"),
      agent_id: z.string().optional().describe("Scope to a specific subagent. Auto-completed on SubagentStop. Subagents: use the agent_id injected by pre-tool-context-injector"),
    },
  },
  async ({ event, description, blocking, content, condition, agent_id }) => {
    const id = `dh-${_incrementHookCounter()}`;
    // Stop defaults to blocking, most others default to inject
    const isBlocking = blocking ?? (event === "Stop");
    const hook: DynamicHook = {
      id, event, description,
      blocking: isBlocking,
      completed: false,
      added_at: new Date().toISOString(),
    };
    if (content) hook.content = content;
    if (condition) hook.condition = condition;
    if (agent_id) hook.agent_id = agent_id;
    dynamicHooks.set(id, hook);
    _persistHooks();
    const agentNote = agent_id ? ` (scoped to subagent ${agent_id})` : "";
    const typeLabel = isBlocking ? "blocking" : "inject";
    const condNote = condition ? ` [condition: ${JSON.stringify(condition)}]` : "";
    return {
      content: [{
        type: "text" as const,
        text: `Hook registered: [${id}] ${event}/${typeLabel} — ${description}${agentNote}${condNote}\nActive hooks: ${_pendingHooksSummary()}.`,
      }],
    };
  }
);

server.registerTool(
  "complete_hook",
  {
    description: "Mark a blocking hook as completed (unblocks the event). Call after performing the verification described in the hook. Pass 'all' to complete every pending blocking hook at once.",
    inputSchema: {
      id: z.string().describe("Hook ID (e.g. 'dh-1'). Use 'all' to complete all pending blocking hooks"),
      result: z.string().optional().describe("Brief outcome (e.g. 'PASS — 0 errors'). Stored for audit"),
    },
  },
  async ({ id, result }) => {
    if (id === "all") {
      const pending = [...dynamicHooks.values()].filter(h => h.blocking && !h.completed);
      if (pending.length === 0) {
        return { content: [{ type: "text" as const, text: "No pending blocking hooks to complete." }] };
      }
      const now = new Date().toISOString();
      for (const hook of pending) {
        hook.completed = true;
        hook.completed_at = now;
        if (result) hook.result = result;
      }
      _persistHooks();
      return {
        content: [{
          type: "text" as const,
          text: `Completed ${pending.length} hook(s). All blocking hooks cleared.`,
        }],
      };
    }
    const hook = dynamicHooks.get(id);
    if (!hook) {
      return { content: [{ type: "text" as const, text: `No hook with ID '${id}'.` }], isError: true };
    }
    hook.completed = true;
    hook.completed_at = new Date().toISOString();
    if (result) hook.result = result;
    _persistHooks();
    const pending = [...dynamicHooks.values()].filter(h => h.blocking && !h.completed);
    const resultNote = result ? ` (${result})` : "";
    return {
      content: [{
        type: "text" as const,
        text: `Completed: [${id}] ${hook.description}${resultNote}\n${pending.length} blocking hook(s) remaining.`,
      }],
    };
  }
);

server.registerTool(
  "list_hooks",
  {
    description: "List all active hooks (static infrastructure + dynamic runtime hooks). Shows what fires on each event, whether it blocks or injects, and its current status.",
    inputSchema: {
      event: z.string().optional().describe("Filter to a specific event (e.g. 'Stop', 'PreToolUse'). Omit for all events"),
      include_static: z.boolean().optional().describe("Include static infrastructure hooks from manifest (default: true)"),
    },
  },
  async ({ event, include_static }) => {
    const showStatic = include_static !== false;
    const lines: string[] = ["# Active Hooks\n"];

    // ── Dynamic hooks (runtime-registered by this worker) ──
    const dynamicList = [...dynamicHooks.values()]
      .filter(h => !event || h.event === event)
      .sort((a, b) => a.event.localeCompare(b.event) || a.id.localeCompare(b.id));

    if (dynamicList.length > 0) {
      lines.push(`## Dynamic Hooks (${dynamicList.length})\n`);
      for (const h of dynamicList) {
        const type = h.blocking ? "GATE" : "INJECT";
        const status = h.blocking
          ? (h.completed ? `DONE${h.result ? ` (${h.result})` : ""}` : "PENDING")
          : "active";
        const cond = h.condition ? ` [${Object.entries(h.condition).map(([k,v]) => `${k}=${v}`).join(", ")}]` : "";
        const scope = h.agent_id ? ` (agent: ${h.agent_id})` : "";
        lines.push(`- **[${h.id}]** ${h.event}/${type} — ${h.description}${cond}${scope}`);
        lines.push(`  Status: ${status} | Added: ${h.added_at.slice(0, 16)}`);
        if (h.content && h.content !== h.description) {
          const preview = h.content.length > 100 ? h.content.slice(0, 97) + "..." : h.content;
          lines.push(`  Content: "${preview}"`);
        }
      }
    } else {
      lines.push("## Dynamic Hooks\nNone registered. Use `add_hook()` to add verification gates or context injectors.\n");
    }

    // ── Static hooks (infrastructure, from manifest) ──
    if (showStatic) {
      try {
        const manifestPath = join(CLAUDE_OPS, "hooks", "manifest.json");
        const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
        const staticHooks = (manifest.hooks || []).filter((h: any) =>
          h.id && h.event && (!event || h.event === event) && !h._comment
        );

        if (staticHooks.length > 0) {
          // Group by category
          const byCategory: Record<string, any[]> = {};
          for (const h of staticHooks) {
            const cat = h.category || "other";
            if (!byCategory[cat]) byCategory[cat] = [];
            byCategory[cat].push(h);
          }

          lines.push(`\n## Static Hooks (${staticHooks.length} from manifest)\n`);
          for (const [cat, hooks] of Object.entries(byCategory)) {
            lines.push(`### ${cat}`);
            for (const h of hooks) {
              lines.push(`- **${h.id}** (${h.event}) — ${h.description}`);
            }
          }
        }
      } catch {
        lines.push("\n## Static Hooks\n_Could not read manifest.json_");
      }
    }

    // Summary
    const blocking = [...dynamicHooks.values()].filter(h => h.blocking && !h.completed);
    const inject = [...dynamicHooks.values()].filter(h => !h.blocking);
    lines.push(`\n---\n**Summary:** ${dynamicHooks.size} dynamic (${blocking.length} blocking pending, ${inject.length} inject active)`);

    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  }
);

server.registerTool(
  "remove_hook",
  {
    description: "Remove a dynamic hook entirely. Use for inject hooks you no longer need, or to clean up completed gates.",
    inputSchema: {
      id: z.string().describe("Hook ID to remove (e.g. 'dh-2'). Use 'all' to remove all hooks"),
    },
  },
  async ({ id }) => {
    if (id === "all") {
      const count = dynamicHooks.size;
      dynamicHooks.clear();
      _persistHooks();
      return { content: [{ type: "text" as const, text: `Removed all ${count} hook(s).` }] };
    }
    const hook = dynamicHooks.get(id);
    if (!hook) {
      return { content: [{ type: "text" as const, text: `No hook with ID '${id}'.` }], isError: true };
    }
    dynamicHooks.delete(id);
    _persistHooks();
    return {
      content: [{
        type: "text" as const,
        text: `Removed: [${id}] ${hook.description}\nRemaining hooks: ${_pendingHooksSummary()}.`,
      }],
    };
  }
);

} // end registerHookTools
