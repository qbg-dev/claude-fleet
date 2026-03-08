#!/usr/bin/env bash
# deep-review.sh — Launch Bugbot-style multi-pass code review
#
# Creates a "bug-bot" tmux window with 9 panes:
#   Pane 0: Coordinator — aggregates findings, voting, validation, fix proposals
#   Panes 1-8: Review workers — each reviews diff with randomized chunk ordering
#
# Usage:
#   bash ~/.claude-ops/scripts/deep-review.sh                     # review changes since main
#   bash ~/.claude-ops/scripts/deep-review.sh --base develop      # review changes since develop
#   bash ~/.claude-ops/scripts/deep-review.sh --uncommitted       # review uncommitted changes
#   bash ~/.claude-ops/scripts/deep-review.sh --commit abc123     # review a specific commit
#   bash ~/.claude-ops/scripts/deep-review.sh --pr 42             # review a PR (all commits)
set -euo pipefail

CLAUDE_OPS="${CLAUDE_OPS_DIR:-$HOME/.claude-ops}"
TEMPLATE_DIR="$CLAUDE_OPS/templates/deep-review"
PROJECT_ROOT="${PROJECT_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
TMUX_SESSION="${TMUX_SESSION:-h}"
WINDOW_NAME="bug-bot"
NUM_PASSES=8
WORKER_MODEL="${DEEP_REVIEW_WORKER_MODEL:-opus}"
COORD_MODEL="${DEEP_REVIEW_COORD_MODEL:-sonnet}"

# ── Parse args ────────────────────────────────────────────────
DIFF_MODE="base"
BASE_BRANCH="main"
COMMIT=""
PR_NUMBER=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base) BASE_BRANCH="$2"; shift 2 ;;
    --uncommitted) DIFF_MODE="uncommitted"; shift ;;
    --commit) DIFF_MODE="commit"; COMMIT="$2"; shift 2 ;;
    --pr) DIFF_MODE="pr"; PR_NUMBER="$2"; shift 2 ;;
    --passes) NUM_PASSES="$2"; shift 2 ;;
    --window) WINDOW_NAME="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: deep-review.sh [--base BRANCH] [--uncommitted] [--commit SHA] [--pr NUM]"
      echo "  --base BRANCH     Compare against branch (default: main)"
      echo "  --uncommitted     Review uncommitted changes"
      echo "  --commit SHA      Review a specific commit"
      echo "  --pr NUM          Review a pull request"
      echo "  --passes N        Number of parallel passes (default: 8)"
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

# ── Validate environment ─────────────────────────────────────
if ! tmux info &>/dev/null; then
  echo "ERROR: tmux not running" >&2; exit 1
fi

if [ ! -f "$TEMPLATE_DIR/worker-seed.md" ] || [ ! -f "$TEMPLATE_DIR/coordinator-seed.md" ]; then
  echo "ERROR: Templates not found at $TEMPLATE_DIR" >&2; exit 1
fi

cd "$PROJECT_ROOT"

# ── Create session directory ─────────────────────────────────
SESSION_ID=$(date -u '+%Y%m%d-%H%M%S')
SESSION_DIR="$PROJECT_ROOT/.claude/state/deep-review/session-$SESSION_ID"
mkdir -p "$SESSION_DIR"
HISTORY_FILE="$PROJECT_ROOT/.claude/state/deep-review/history.jsonl"

echo "Session: $SESSION_DIR"

# ── Generate diff ────────────────────────────────────────────
echo "Generating diff..."
case "$DIFF_MODE" in
  base)
    git diff "${BASE_BRANCH}...HEAD" > "$SESSION_DIR/diff-full.patch" 2>/dev/null || \
    git diff "${BASE_BRANCH}..HEAD" > "$SESSION_DIR/diff-full.patch"
    DIFF_DESC="changes since $BASE_BRANCH"
    ;;
  uncommitted)
    { git diff; git diff --cached; } > "$SESSION_DIR/diff-full.patch"
    DIFF_DESC="uncommitted changes"
    ;;
  commit)
    git show "$COMMIT" > "$SESSION_DIR/diff-full.patch"
    DIFF_DESC="commit $COMMIT"
    ;;
  pr)
    # Use gh to get PR diff
    gh pr diff "$PR_NUMBER" > "$SESSION_DIR/diff-full.patch"
    DIFF_DESC="PR #$PR_NUMBER"
    ;;
esac

DIFF_LINES=$(wc -l < "$SESSION_DIR/diff-full.patch" | tr -d ' ')
echo "Diff: $DIFF_LINES lines ($DIFF_DESC)"

if [ "$DIFF_LINES" -eq 0 ]; then
  echo "ERROR: Empty diff — nothing to review" >&2
  rm -rf "$SESSION_DIR"
  exit 1
fi

# ── Split diff + generate randomized orderings ───────────────
echo "Generating $NUM_PASSES randomized diff orderings..."

python3 << 'PYEOF' - "$SESSION_DIR/diff-full.patch" "$SESSION_DIR" "$NUM_PASSES"
import sys, os, random, json

diff_file = sys.argv[1]
session_dir = sys.argv[2]
num_passes = int(sys.argv[3])

with open(diff_file) as f:
    content = f.read()

# Split into file-level chunks at "diff --git" boundaries
chunks = []
current = []
for line in content.split('\n'):
    if line.startswith('diff --git ') and current:
        chunks.append('\n'.join(current))
        current = []
    current.append(line)
if current:
    chunks.append('\n'.join(current))

print(f"  Split into {len(chunks)} file-level chunks")

# Generate randomized orderings (each pass gets a different shuffle)
for i in range(1, num_passes + 1):
    shuffled = chunks[:]
    random.shuffle(shuffled)
    outpath = os.path.join(session_dir, f'diff-pass-{i}.patch')
    with open(outpath, 'w') as f:
        f.write('\n'.join(shuffled))

# Write session metadata
meta = {
    'session_id': os.path.basename(session_dir),
    'num_chunks': len(chunks),
    'num_passes': num_passes,
    'diff_lines': content.count('\n'),
    'created_at': __import__('datetime').datetime.utcnow().isoformat() + 'Z'
}
with open(os.path.join(session_dir, 'meta.json'), 'w') as f:
    json.dump(meta, f, indent=2)
PYEOF

# ── Generate seed prompts from templates ─────────────────────
echo "Generating seed prompts..."

for i in $(seq 1 "$NUM_PASSES"); do
  sed \
    -e "s|{{PASS_NUMBER}}|$i|g" \
    -e "s|{{NUM_PASSES}}|$NUM_PASSES|g" \
    -e "s|{{DIFF_FILE}}|$SESSION_DIR/diff-pass-$i.patch|g" \
    -e "s|{{OUTPUT_FILE}}|$SESSION_DIR/findings-pass-$i.json|g" \
    -e "s|{{PROJECT_ROOT}}|$PROJECT_ROOT|g" \
    -e "s|{{SESSION_DIR}}|$SESSION_DIR|g" \
    "$TEMPLATE_DIR/worker-seed.md" > "$SESSION_DIR/worker-$i-seed.md"
done

sed \
  -e "s|{{SESSION_DIR}}|$SESSION_DIR|g" \
  -e "s|{{SESSION_ID}}|$SESSION_ID|g" \
  -e "s|{{PROJECT_ROOT}}|$PROJECT_ROOT|g" \
  -e "s|{{NUM_PASSES}}|$NUM_PASSES|g" \
  -e "s|{{REPORT_FILE}}|$SESSION_DIR/report.md|g" \
  -e "s|{{HISTORY_FILE}}|$HISTORY_FILE|g" \
  "$TEMPLATE_DIR/coordinator-seed.md" > "$SESSION_DIR/coordinator-seed.md"

# ── Create launch wrappers ───────────────────────────────────
# Each pane runs a wrapper script that launches Claude with the seed prompt.
# Claude reads the seed file as its first action via the prompt.

for i in $(seq 1 "$NUM_PASSES"); do
  cat > "$SESSION_DIR/run-pass-$i.sh" << WEOF
#!/usr/bin/env bash
cd "$PROJECT_ROOT"
exec claude --model $WORKER_MODEL --dangerously-skip-permissions "\$(cat '$SESSION_DIR/worker-$i-seed.md')"
WEOF
  chmod +x "$SESSION_DIR/run-pass-$i.sh"
done

cat > "$SESSION_DIR/run-coordinator.sh" << CEOF
#!/usr/bin/env bash
cd "$PROJECT_ROOT"
exec claude --model $COORD_MODEL --dangerously-skip-permissions "\$(cat '$SESSION_DIR/coordinator-seed.md')"
CEOF
chmod +x "$SESSION_DIR/run-coordinator.sh"

# ── Create tmux window ───────────────────────────────────────
echo "Creating $WINDOW_NAME window ($((NUM_PASSES + 1)) panes)..."

# Kill existing window if present
if tmux list-windows -t "$TMUX_SESSION" -F '#{window_name}' 2>/dev/null | grep -q "^${WINDOW_NAME}$"; then
  echo "  Killing existing $WINDOW_NAME window"
  tmux kill-window -t "$TMUX_SESSION:$WINDOW_NAME"
fi

# Create window (detached so we don't disrupt Warren's view)
tmux new-window -d -t "$TMUX_SESSION" -n "$WINDOW_NAME"

# Split into NUM_PASSES additional panes (total: 1 + NUM_PASSES)
for i in $(seq 1 "$NUM_PASSES"); do
  tmux split-window -d -t "$TMUX_SESSION:$WINDOW_NAME"
done

tmux select-layout -t "$TMUX_SESSION:$WINDOW_NAME" tiled

# Small delay for panes to initialize
sleep 1

# ── Launch workers first (panes 1-8) ────────────────────────
echo "Launching $NUM_PASSES review workers..."

# Get pane IDs in order
mapfile -t PANE_IDS < <(tmux list-panes -t "$TMUX_SESSION:$WINDOW_NAME" -F '#{pane_id}')

for i in $(seq 1 "$NUM_PASSES"); do
  WORKER_PANE="${PANE_IDS[$i]}"
  echo "  Pass $i → pane $WORKER_PANE"
  tmux send-keys -t "$WORKER_PANE" "bash '$SESSION_DIR/run-pass-$i.sh'" Enter
  sleep 0.5  # stagger launches slightly
done

# ── Launch coordinator (pane 0) ──────────────────────────────
echo "Launching coordinator..."
COORD_PANE="${PANE_IDS[0]}"
tmux send-keys -t "$COORD_PANE" "bash '$SESSION_DIR/run-coordinator.sh'" Enter

# ── Summary ──────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  DEEP REVIEW LAUNCHED"
echo ""
echo "  Window:      $TMUX_SESSION:$WINDOW_NAME"
echo "  Session:     $SESSION_DIR"
echo "  Reviewing:   $DIFF_DESC ($DIFF_LINES lines)"
echo "  Passes:      $NUM_PASSES (model: $WORKER_MODEL)"
echo "  Coordinator: pane 0 (model: $COORD_MODEL)"
echo "  Workers:     panes 1-$NUM_PASSES"
echo ""
echo "  The coordinator will:"
echo "    1. Wait for all $NUM_PASSES workers to complete"
echo "    2. Aggregate + bucket similar findings"
echo "    3. Apply majority voting (>=2/$NUM_PASSES)"
echo "    4. Validate each surviving finding"
echo "    5. Dedupe against history"
echo "    6. Propose + apply fixes"
echo "    7. Write report to $SESSION_DIR/report.md"
echo "════════════════════════════════════════════════════════════"
