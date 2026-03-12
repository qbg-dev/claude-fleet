# Hook-Based Multi-Agent Orchestration

Pattern for writing multi-phase agent pipelines with full tmux visibility. Derived from the deep review pipeline (3-phase, 22 agents) and fleet worker lifecycle.

---

## The pattern in one paragraph

Create all tmux windows upfront — one per role in the pipeline. The first window is a manifest showing the full orchestration plan. Agents that belong to later phases see a "waiting for hook" message in their pane until their phase arrives. When a phase completes, its Stop hook fires a bridge script in a visible bridge window. The bridge sends launch commands to the waiting panes. No background processes, no polling loops, no hidden state.

---

## Three axioms

### 1. Everything is a window or pane. Nothing is hidden.

Every process in the pipeline — agents, bridges, coordinators, verifiers, cleanup — runs in a tmux pane. If you can't see it in `tmux list-panes`, it doesn't exist.

**Never:**
- `nohup ... &` (hidden background process)
- `while [ ! -f done ]; sleep 15; done` (polling loop occupying a pane)
- Subprocess that outlives its parent pane

**Always:**
- Bridge scripts run in a named `bridge-N` window
- Waiting agents show a status line ("Waiting for Phase 2 hook...")
- `tee` output to both the pane and a log file

### 2. All windows are created at launch. The layout is the plan.

When the pipeline starts, create every tmux window that will ever exist in this run. Phases that haven't started yet show their panes in a waiting state. The user can `tmux list-windows` at any point and see the full scope of the pipeline.

```
tmux session: pipeline-{hash}
  0: manifest       ← human-readable orchestration plan (always window 0)
  1: bridge-0       ← Phase 0→1 bridge (shows "waiting" until Phase 0 completes)
  2: planning       ← Phase 0 agents (launch immediately)
  3: bridge-1       ← Phase 1→2 bridge (shows "waiting" until Phase 1 completes)
  4: workers-1      ← Phase 2 agents (show "waiting" until bridge-1 fires)
  5: workers-2      ← Phase 2 agents (show "waiting" until bridge-1 fires)
  6: coordinator    ← Phase 2 coordinator (show "waiting" until bridge-1 fires)
  7: verifiers      ← Phase 3 agents (show "waiting" until coordinator hook fires)
```

The window order tells the story: manifest → bridge → phase → bridge → phase → ... Reading left to right is reading the pipeline chronologically.

### 3. Phase transitions are hooks, not polls.

An agent finishing a phase triggers the next phase via a Stop hook. The hook sends a command to a waiting pane. The waiting pane was created at pipeline start and has been displaying a status message.

**Anti-pattern (polling):**
```bash
# BAD — verifier sits in a sleep loop burning a pane on nothing
while [ ! -f review.done ]; do
  sleep 15
  echo "... still waiting"
done
exec claude --model sonnet "$(cat seed.md)"
```

**Correct pattern (hook-triggered):**
```bash
# Pane shows this at launch:
echo "═══ Verifier (script) ═══"
echo "Waiting for coordinator Stop hook to trigger launch..."
echo "Hook: coordinator → verifier-gate → this pane"
echo ""
echo "While waiting, review the manifest: tmux select-window -t :manifest"

# The pane blocks on a FIFO (named pipe), not a poll loop:
FIFO="$SESSION_DIR/fifo-verifier-script"
mkfifo "$FIFO" 2>/dev/null
cat "$FIFO" > /dev/null  # blocks until hook writes to FIFO

# Hook writes "go" to the FIFO, pane unblocks:
echo "Hook received. Launching verifier..."
exec claude --model sonnet "$(cat seed.md)"
```

The coordinator's Stop hook writes to each verifier's FIFO:
```bash
# In coordinator-stop.sh:
for fifo in "$SESSION_DIR"/fifo-verifier-*; do
  echo "go" > "$fifo" &
done
```

---

## Building blocks

### 1. Manifest window

Window 0 is always a human-readable description of the pipeline. Created at launch, never modified. Shows:

```
═══════════════════════════════════════════════════
  PIPELINE MANIFEST — deep-review v1.2
  Session: dr-chief-of-staff-deploy-from-9f976eb6
  Created: 2026-03-12 01:53:54
═══════════════════════════════════════════════════

PHASES
──────
  Phase 0: Planning
    Agents:  role-designer (Opus), review-improver (Opus)
    Hook:    role-designer Stop → bridge-0 → launches improver
    Hook:    improver Stop → bridge-1 → launches workers

  Phase 1: Review
    Agents:  16 workers (Sonnet), 1 coordinator (Sonnet), 1 judge (Opus)
    Hook:    coordinator Stop → triggers verifiers

  Phase 2: Verification
    Agents:  4 verifiers (chrome, curl, test, script)
    Hook:    all verifiers done → cleanup available

WINDOWS
───────
  :manifest       This window
  :bridge-0       Bridge: Phase 0 → Phase 1 (hook-triggered)
  :planning       role-designer + improver
  :bridge-1       Bridge: Phase 1 → Phase 2 (hook-triggered)
  :coordinator    Coordinator agent
  :workers-1      Workers 1-4
  :workers-2      Workers 5-8
  :workers-3      Workers 9-12
  :workers-4      Workers 13-16
  :verifiers      chrome / curl / test / script (hook-triggered)

HOOKS (6)
─────
  1. role-designer Stop    → bridge-0 (provisions improver)
  2. improver Stop         → bridge-1 (provisions workers + coordinator)
  3. coordinator Stop      → fifo-verifier-* (unblocks verifiers)
  4. verifier-chrome Stop  → verifier-done-counter
  5. verifier-curl Stop    → verifier-done-counter
  6. verifier-test Stop    → verifier-done-counter

FILES
─────
  State:   /path/to/session-dir/pipeline-state.json
  Report:  /path/to/session-dir/report.md
  Cleanup: /path/to/session-dir/cleanup-fleet.sh
  Logs:    /path/to/session-dir/bridge-*.log
```

**Rule:** The manifest is generated by the launch script, not by an agent. It's a static file rendered with `cat`. Anyone attaching to the tmux session sees the full plan immediately.

### 2. Pipeline state file

One JSON file is the single source of truth. Every bridge reads it, enriches it, writes it back.

```
session-dir/
  pipeline-state.json    ← flows through all phases
  manifest.txt           ← human-readable plan (displayed in window 0)
  bridge-0.log           ← per-bridge output
  bridge-1.log
  fifo-verifier-chrome   ← named pipes for hook-triggered launches
  fifo-verifier-curl
  worker-1-seed.md       ← generated prompts
  run-worker-1.sh        ← generated launch wrappers
```

**Rule:** All inter-phase data goes through `pipeline-state.json`. Agents within a phase communicate via Fleet Mail. Never use shared files for intra-phase coordination.

### 3. Hook-chained phase transitions

Each phase's agents register a Stop hook at provisioning time. The hook sends a command to a pre-existing tmux pane — it does not create new windows.

```
Phase A agent finishes
  → Stop hook fires phase-A-stop.sh
  → Hook sends launch command to the pre-existing bridge-N pane
  → Bridge pane unblocks, runs bridge logic (visible in real-time)
  → Bridge sends launch commands to pre-existing worker panes
  → Worker panes unblock, exec claude
```

**Rule:** Hooks unblock panes. They never create panes. All panes exist from the start.

### 4. Waiting panes

Panes for later phases display a status message and block on a FIFO until their hook fires.

```bash
#!/usr/bin/env bash
# Launch wrapper for a hook-triggered agent
set -euo pipefail

FIFO="$SESSION_DIR/fifo-$WORKER_NAME"
SEED="$SESSION_DIR/$WORKER_NAME-seed.md"

# Display status while waiting
clear
echo "═══ $WORKER_NAME ═══"
echo "Role: $ROLE_DESCRIPTION"
echo "Phase: $PHASE_NUMBER (waiting for hook)"
echo "Trigger: $TRIGGER_DESCRIPTION"
echo ""
echo "Blocked on: $FIFO"
echo "Will run: claude --model $MODEL"
echo ""
echo "$(date '+%H:%M:%S') Waiting for hook..."

# Block until hook writes to FIFO
mkfifo "$FIFO" 2>/dev/null || true
cat "$FIFO" > /dev/null

# Hook fired — launch
echo "$(date '+%H:%M:%S') Hook received. Launching..."
exec claude --model "$MODEL" --dangerously-skip-permissions "$(cat "$SEED")"
```

**Rule:** Waiting panes are informative. They show what they're waiting for, what will run, and when they were created. A user glancing at any pane immediately understands the pipeline state.

### 5. Bridge windows

Bridge windows are pre-created at pipeline start in a waiting state. When a hook fires, it unblocks the bridge pane. The bridge runs its logic visibly, then shows completion status.

```bash
#!/usr/bin/env bash
# Bridge pane wrapper (pre-created, hook-triggered)
set -euo pipefail

FIFO="$SESSION_DIR/fifo-bridge-$PHASE"

echo "═══ Bridge: Phase $FROM → Phase $TO ═══"
echo "Waiting for Phase $FROM completion hook..."
echo ""

# Block until hook fires
mkfifo "$FIFO" 2>/dev/null || true
cat "$FIFO" > /dev/null

echo "$(date '+%H:%M:%S') Hook received. Running bridge..."
echo ""

# Run bridge logic with visible output + log file
bun "$FLEET_DIR/cli/lib/deep-review/pipeline-bridge.ts" \
  "phase${FROM}-to-${TO}" "$SESSION_DIR" 2>&1 | tee -a "$SESSION_DIR/bridge-${PHASE}.log"

echo ""
echo "$(date '+%H:%M:%S') Bridge complete."
echo "Press Enter to close this window."
read
```

**Rule:** Bridge windows are created at launch, not by hooks. Hooks only unblock them.

### 6. Sidecar context files

Hook scripts can't receive function arguments. Write context files next to the script at provisioning time.

```
~/.claude/fleet/{project}/{worker}/hooks/
  hooks.json          ← hook registration
  phase-stop.sh       ← the script (copied from source)
  session-dir.txt     ← sidecar: path to pipeline session directory
```

```bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SESSION_DIR="$(cat "$SCRIPT_DIR/session-dir.txt")"
```

**Rule:** One sidecar file per piece of context. Plain text. Named descriptively. Written at provisioning time, never modified after.

### 7. Fleet provisioning per agent

Each agent gets a fleet directory with identity, config, and state:

```
~/.claude/fleet/{project}/{agent-name}/
  config.json     ← model, permissions, worktree path, MCP config
  state.json      ← status, pane_id, tmux_session, custom metadata
  mission.md      ← agent's role description
  token           ← Fleet Mail auth token
  hooks/          ← Stop hooks for next phase transition
```

**Rule:** Provision all agents across ALL phases at once, before launching anything. The manifest reflects the full fleet. Partial provisioning breaks Fleet Mail routing and makes the manifest incomplete.

### 8. Seed prompts from templates

Each agent's initial prompt is generated from templates + pipeline state + material. Written to the session directory, referenced by launch wrappers.

**Rule:** Seeds are static files, generated once during initial provisioning. Dynamic coordination happens via Fleet Mail, not seed updates.

### 9. Launch wrappers

Shell scripts that set environment variables and exec Claude. One per agent.

```bash
#!/usr/bin/env bash
cd "/path/to/worktree"
export FLEET_MAIL_URL="http://..."
export FLEET_MAIL_TOKEN="..."
export FLEET_MAIL_ACCOUNT="worker-1@project"
export PROJECT_ROOT="/path/to/worktree"
export HOOKS_DIR="/path/to/hooks"
exec claude --model sonnet --dangerously-skip-permissions "$(cat '/path/to/seed.md')"
```

**Rule:** `exec` replaces the shell process so `pane_current_command` shows `claude`, not `bash`. Launch wrappers are generated, not hand-written.

### 10. Graceful degradation

Every phase has a fallback. The pipeline continues even if intermediate phases fail.

| Phase failure | Fallback |
|---------------|----------|
| Role designer produces no output | Use static focus areas (v1 mode) |
| REVIEW.md improver fails | Use original REVIEW.md |
| Context pre-pass times out | Skip — workers review without dep graph |
| Worker crashes mid-review | Coordinator redistributes via mail |
| Fleet Mail unreachable | Workers write findings to local files |

**Rule:** Touch a marker file (e.g., `roles-fallback`) when falling back. The bridge checks for markers and adjusts. Never abort the pipeline for a non-fatal failure.

### 11. Cleanup scripts

Auto-generated during initial provisioning. Tears down all fleet workers, worktrees, and tmux sessions.

**Rule:** Always generate a cleanup script. Include it in the session directory. Listed in the manifest.

---

## Sequencing rules

1. **Create everything, then start Phase 0.** The full tmux layout (all windows, all panes) is created in one burst at pipeline start. Only Phase 0 agents are unblocked. Everything else waits on FIFOs.

2. **Provision all phases at once.** Fleet directories, Fleet Mail accounts, seed prompts, and launch wrappers for every agent across every phase are generated before a single agent starts. The manifest is complete from the beginning.

3. **One bridge per transition.** Phase A → Phase B has exactly one bridge. If Phase A has multiple agents, one is designated the "gate" agent whose Stop hook triggers the bridge.

4. **Hooks unblock panes, never create them.** A Stop hook writes to a FIFO or sends keys to a pre-existing pane. It never calls `tmux new-window` or `tmux split-window`.

5. **Bridges are synchronous within their window.** The bridge script runs top-to-bottom: parse → update state → send launch signals to worker FIFOs. No async fan-out inside the bridge. Fan-out happens when multiple panes unblock simultaneously.

6. **State serialization is the commit point.** Write `pipeline-state.json` at the end of each bridge, after all panes are unblocked. If the bridge crashes before serialization, the previous state is intact for retry.

7. **Hooks are write-once.** Write the Stop hook at provisioning time. Never modify it during the agent's lifetime.

---

## Anti-patterns

### Polling loop (verifier "still waiting" bug)

```bash
# BAD — burns a pane on a sleep loop, no hook integration
while [ ! -f review.done ]; do
  sleep 15
  echo "  ... still waiting ($(date +%H:%M:%S))"
done
```

**Why it's wrong:** Hidden dependency on a file. No hook chain. Pane is occupied but doing nothing useful. User sees cryptic "still waiting" with no context about what it's waiting for or what will trigger it.

**Fix:** Block on a FIFO. Coordinator's Stop hook writes to the FIFO.

### Background bridge process

```bash
# BAD — bridge runs invisible
nohup bun pipeline-bridge.ts phase0-to-05 "$SESSION_DIR" \
  >> "$SESSION_DIR/bridge-phase0.log" 2>&1 &
```

**Why it's wrong:** No visibility. Bridge could crash silently. User can't watch provisioning happen. Must `cat` log file after the fact.

**Fix:** Bridge runs in a pre-created tmux window, unblocked by a FIFO.

### Creating windows mid-pipeline

```bash
# BAD — hook creates a new window that didn't exist at launch
tmux new-window -d -t "$SESSION" -n "bridge" bash -c "$BRIDGE_CMD"
```

**Why it's wrong:** The manifest doesn't reflect the actual layout. User can't predict what windows will exist. Layout changes as the pipeline runs.

**Fix:** Create the bridge window at launch with a waiting pane. Hook unblocks it.

---

## Startup sequence

The pipeline launcher does everything in this order:

```
1. Generate pipeline-state.json (config, material, context)
2. Provision all agents across all phases (fleet dirs, mail, tokens)
3. Generate all seed prompts and launch wrappers
4. Generate manifest.txt from pipeline state
5. Create tmux session with ALL windows and panes:
   a. :manifest        — cat manifest.txt
   b. :bridge-0        — waiting on fifo-bridge-0
   c. :planning        — Phase 0 agents (launched immediately)
   d. :bridge-1        — waiting on fifo-bridge-1
   e. :workers-1..N    — waiting on fifo-worker-*
   f. :coordinator     — waiting on fifo-coordinator
   g. :verifiers       — waiting on fifo-verifier-*
6. Write Stop hooks for Phase 0 agents
7. Unblock Phase 0 panes (or launch directly — they're first)
8. Print session attach command
```

After step 7, the pipeline is self-sustaining. No central process keeps running.

---

## Debugging checklist

When a phase transition doesn't fire:

```
1. Is the agent's Stop hook registered?
   → Check ~/.claude/fleet/{project}/{agent}/hooks/hooks.json

2. Did the hook engine fire the script?
   → Check the agent's pane for hook engine output on exit

3. Did the hook write to the FIFO?
   → ls -la $SESSION_DIR/fifo-*  (FIFO should disappear after read)
   → Check the bridge/worker pane — still showing "Waiting"?

4. Did the bridge complete?
   → Switch to the bridge-N window — output is visible
   → Check session-dir/bridge-N.log

5. Did worker panes unblock but claude didn't start?
   → Check pane_current_command (should be claude, not bash)
   → Read the launch wrapper script for env var issues

6. Full pipeline state?
   → Window 0 (:manifest) shows every hook, agent, and file path
```

---

## Minimal example (2-phase pipeline)

```
Phase 0: Planner agent designs a work plan
  → Stop hook unblocks bridge-0
  → Bridge provisions worker seeds, unblocks worker panes
Phase 1: N worker agents execute the plan in parallel
  → Coordinator polls workers via Fleet Mail
  → Workers send findings back
  → Coordinator writes final report
```

Tmux layout (created at launch):
```
  :manifest      Plan description + hook table
  :bridge-0      Waiting for planner Stop hook
  :planner       Planner agent (launches immediately)
  :coordinator   Waiting for bridge-0
  :workers       Waiting for bridge-0 (4 panes)
```

Files needed:
- `pipeline-bridge.ts` — bridge logic (parse plan → generate seeds → unblock FIFOs)
- `planner-stop.sh` — writes to fifo-bridge-0
- Seed templates for planner, workers, coordinator
- Manifest template

The bridge is ~200 lines. The hook scripts are ~15 lines each (just write to a FIFO). Everything else is generated.
