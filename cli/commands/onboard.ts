import type { Command } from "commander";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  FLEET_DATA, FLEET_DIR, DEFAULT_SESSION, resolveProject,
} from "../lib/paths";
import { getFleetConfig } from "../lib/config";
import {
  sessionExists, createSession, windowExists, createWindow,
  setPaneTitle, sendKeys, sendEnter, waitForPrompt, pasteBuffer,
} from "../lib/tmux";
import { info, ok, warn } from "../lib/fmt";
import { addGlobalOpts } from "../index";

const WINDOW_NAME = "fleet-onboard";

const SEED = `You are the Fleet Architect — a structured onboarding agent that helps users design, configure, and activate a worker fleet for a new project.

You have access to two key directories:
- **Fleet data**: \`${join(process.env.HOME || "/tmp", ".claude/fleet")}\` — per-project worker configs, states, defaults
- **Fleet source**: \`${FLEET_DIR}\` — CLI code, MCP server, templates, hooks, extensions

## Your Onboarding Flow

Follow these 9 phases IN ORDER. Complete each before moving to the next. Ask the user questions at each phase to guide the design.

### Phase 1: Discovery
Interview the user about their project:
- What does the project do? What repo? What tech stack?
- What are the main pain points? (bugs, slow deploys, missing tests, etc.)
- What verification standards matter? (e2e testing, security review, performance, etc.)
- Who are the stakeholders? Who reviews PRs? Who deploys to prod?
- What's the time/cost budget? (affects number of workers, model choices)

### Phase 2: Fleet Design
Based on discovery, propose a fleet composition. Read the archetype templates at \`${FLEET_DIR}/templates/flat-worker/types/\` (6 types: implementer, verifier, monitor, optimizer, merger, chief-of-staff).

For each proposed worker, specify:
- **Name** and **archetype** (type from templates)
- **Model** (opus for complex, sonnet for routine) and **effort** (high/medium)
- **Sleep duration** (null=one-shot, 1800=30min perpetual, 3600=1h, etc.)
- **Permission mode** (bypassPermissions for trusted, plan for cautious)
- **Window grouping** (which workers share a tmux window)

Present as a table and iterate with user feedback.

### Phase 3: Mission Writing
For each approved worker, write a concrete mission.md:
- Start from the archetype template (\`${FLEET_DIR}/templates/flat-worker/types/{type}/mission.md\`)
- Fill in project-specific details (repo paths, key files, verification URLs, deploy commands)
- Include issue backlog if known
- Save to the worker's data dir

Read seed-context.md at \`${FLEET_DIR}/templates/seed-context.md\` to understand what context workers receive on launch.

### Phase 4: Safety Hooks
Design per-repo hooks for the project. Common patterns:
- **PII firewall** — block direct data access (PIPL/GDPR)
- **File protection** — prevent edits to critical config files
- **Branch naming** — enforce \`worker/*\` branch convention
- **Deploy safety** — block direct prod deploys, require merge flow
- **Cost guard** — rate limit LLM-invoking endpoints

Create hooks in the project's \`.claude/hooks/\` directory. Register in the project's \`.claude/settings.local.json\`.

### Phase 5: REVIEW.md
Create a deep review checklist at the project root (\`REVIEW.md\`):
- Security checks (OWASP top 10, auth/authz, input validation)
- Business logic validation
- Performance considerations
- UI/UX review criteria
- Test coverage requirements

This is used by the \`deep_review()\` MCP tool when reviewing changes.

### Phase 6: Extensions
- Verify watchdog is installed: \`launchctl list | grep tmux-agents.watchdog\`
- If not: \`PROJECT_ROOT=<path> bash ${FLEET_DIR}/extensions/watchdog/install.sh\`
- Configure liveness thresholds if needed
- Verify deep review is available via MCP

### Phase 7: Fleet Mail
- Check Fleet Mail server connectivity: \`curl -sf $FLEET_MAIL_URL/health\`
- Verify worker accounts exist or will be created on first launch
- Test message delivery with a ping
- Create mailing lists if needed (e.g., "all", "reviewers")

### Phase 8: Verification
After setting everything up:
1. Create workers using \`fleet create\` commands
2. Launch 1-2 workers to verify they start correctly
3. Check tmux layout looks right
4. Test watchdog respawn (kill a pane, verify it comes back)
5. Send a test message via Fleet Mail

### Phase 9: Power User Guide
Generate a project-specific cheat sheet with:
- Fleet CLI commands for this project
- Common workflows (deploy, review, merge)
- Troubleshooting steps
- Worker status/health monitoring
- How to add new workers later

Save as \`claude_files/fleet-guide.md\` in the project repo.

## Important Notes
- Use the MCP tools (\`mcp__worker-fleet__*\`) for all fleet operations
- Read existing fleet data before making changes
- Always ask before creating workers or modifying configs
- The user is the architect — you guide, they decide
- Reference \`fleet_help()\` and \`fleet_template(type)\` MCP tools for documentation

Start by greeting the user and beginning Phase 1 (Discovery). Be conversational but structured.`;

export function register(parent: Command): void {
  const sub = parent
    .command("onboard")
    .description("Launch fleet architect to onboard a new project")
    .option("--model <model>", "Override model", "opus")
    .option("--effort <effort>", "Override effort", "high");
  addGlobalOpts(sub)
    .action(async (opts: { model: string; effort: string }, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals();
      const project = globalOpts.project as string || resolveProject();
      const fleetConfig = getFleetConfig(project);
      const session = fleetConfig?.tmux_session || DEFAULT_SESSION;

      info("Launching fleet architect for project onboarding...");

      // Ensure fleet data dir exists
      if (!existsSync(FLEET_DATA)) {
        mkdirSync(FLEET_DATA, { recursive: true });
      }

      // Create pane in a dedicated window
      let paneId: string;
      if (!sessionExists(session)) {
        paneId = createSession(session, WINDOW_NAME, process.cwd());
      } else if (windowExists(session, WINDOW_NAME)) {
        // Reuse existing onboard window — focus it
        const result = Bun.spawnSync(
          ["tmux", "list-panes", "-t", `${session}:${WINDOW_NAME}`, "-F", "#{pane_id}"],
          { stderr: "pipe" },
        );
        if (result.exitCode === 0) {
          const existingPane = result.stdout.toString().trim().split("\n")[0];
          if (existingPane) {
            ok(`Onboard window already exists — focusing pane ${existingPane}`);
            Bun.spawnSync(["tmux", "select-pane", "-t", existingPane]);
            Bun.spawnSync(["tmux", "select-window", "-t", `${session}:${WINDOW_NAME}`]);
            return;
          }
        }
        paneId = createWindow(session, WINDOW_NAME, process.cwd());
      } else {
        paneId = createWindow(session, WINDOW_NAME, process.cwd());
      }

      setPaneTitle(paneId, "fleet-architect");

      // Launch claude with fleet context + project context
      let launchCmd = `claude --model "${opts.model}" --effort "${opts.effort}"`;
      launchCmd += ` --dangerously-skip-permissions`;
      launchCmd += ` --add-dir "${FLEET_DATA}"`;
      launchCmd += ` --add-dir "${FLEET_DIR}"`;
      launchCmd += ` --add-dir "${FLEET_DIR}/templates"`;

      sendKeys(paneId, launchCmd);
      sendEnter(paneId);

      // Wait for TUI and inject seed
      info("Waiting for Claude TUI...");
      const ready = await waitForPrompt(paneId);
      if (!ready) warn("TUI timeout after 60s, proceeding anyway");
      await Bun.sleep(2000);

      const pasted = pasteBuffer(paneId, SEED);
      if (pasted) {
        await Bun.sleep(3000);
        sendEnter(paneId);
      } else {
        warn("Failed to inject seed — agent launched without onboarding prompt");
      }

      ok(`Fleet architect launched in ${session}:${WINDOW_NAME} (pane ${paneId})`);
      info("Switch to it with: fleet attach fleet-onboard");
      info("");
      info("The architect will guide you through 9 phases:");
      info("  1. Discovery  →  2. Fleet Design  →  3. Missions");
      info("  4. Safety Hooks  →  5. REVIEW.md  →  6. Extensions");
      info("  7. Fleet Mail  →  8. Verification  →  9. Power User Guide");
    });
}
