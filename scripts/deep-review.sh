#!/usr/bin/env bash
# deep-review.sh — Multi-pass deep review (code diffs, content, or both)
#
# Architecture:
#   Window 0 "coordinator": 1 pane — coordinator (Sonnet)
#   Window 1+ "workers-N":  4 panes tiled per window — review workers (Opus)
#
# Workers = passes × focus areas. Each focus area gets `passes` independent
# workers, each seeing a different randomized ordering of the material.
#
# Material is additive — combine diffs AND content files in a single review:
#   --scope main --content plan.md  →  review diff + plan together
#
# Examples:
#   --scope main                            review changes since main
#   --scope abc1234                         review specific commit
#   --scope uncommitted                     review working changes
#   --scope pr:42                           review a pull request
#   --content plan.md                       review a plan/doc (no diff)
#   --scope main --content design.md        review diff + design doc together
#   --content a.md,b.md --spec "find gaps"  review files with custom spec
#   --passes 1 --focus security             1 worker, security only
#
# Session naming: dr-{worktree}-{descriptor}-{hash}
#
# Unified scope replaces --base/--commit/--uncommitted/--pr:
#   main, develop, feature/x  →  diff since branch (was --base)
#   abc1234, HEAD~3           →  specific commit (was --commit)
#   uncommitted               →  working changes (was --uncommitted)
#   pr:42                     →  pull request (was --pr)
#   HEAD (default when no --content) → current commit
set -euo pipefail

CLAUDE_OPS="${CLAUDE_OPS_DIR:-$HOME/.claude-ops}"
TEMPLATE_DIR="$CLAUDE_OPS/templates/deep-review"
PROJECT_ROOT="${PROJECT_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
PASSES_PER_FOCUS=2
WORKER_MODEL="${DEEP_REVIEW_WORKER_MODEL:-opus}"
COORD_MODEL="${DEEP_REVIEW_COORD_MODEL:-sonnet}"
CUSTOM_SESSION_NAME=""
NOTIFY_TARGET=""
CUSTOM_FOCUS=""
CONTENT_FILES=""
REVIEW_SPEC=""
SCOPE=""

# Default focus areas
DEFAULT_DIFF_FOCUS=(
  "security"
  "logic"
  "error-handling"
  "data-integrity"
  "architecture"
  "performance"
  "ux-impact"
  "completeness"
)

DEFAULT_CONTENT_FOCUS=(
  "correctness"
  "completeness"
  "feasibility"
  "risks"
)

DEFAULT_MIXED_FOCUS=(
  "security"
  "logic"
  "correctness"
  "completeness"
  "feasibility"
  "risks"
)

# ── Parse args ────────────────────────────────────────────────
# Legacy flags still work for backwards compatibility
while [[ $# -gt 0 ]]; do
  case "$1" in
    --scope)   SCOPE="$2"; shift 2 ;;
    --content) CONTENT_FILES="$2"; shift 2 ;;
    --spec)    REVIEW_SPEC="$2"; shift 2 ;;
    --passes)  PASSES_PER_FOCUS="$2"; shift 2 ;;
    --session-name) CUSTOM_SESSION_NAME="$2"; shift 2 ;;
    --notify)  NOTIFY_TARGET="$2"; shift 2 ;;
    --focus)   CUSTOM_FOCUS="$2"; shift 2 ;;
    # Legacy aliases
    --base)        SCOPE="$2"; shift 2 ;;
    --commit)      SCOPE="$2"; shift 2 ;;
    --uncommitted) SCOPE="uncommitted"; shift ;;
    --pr)          SCOPE="pr:$2"; shift 2 ;;
    -h|--help)
      echo "Usage: deep-review.sh [--scope SCOPE] [--content FILE] [--spec TEXT] [options]"
      echo ""
      echo "Material sources (additive — combine both for richer reviews):"
      echo "  --scope SCOPE        Git diff scope. Auto-detects:"
      echo "                         branch name → diff since branch"
      echo "                         SHA/ref     → specific commit"
      echo "                         uncommitted → working changes"
      echo "                         pr:N        → pull request"
      echo "                         HEAD        → current commit (default if no --content)"
      echo "  --content FILE       Review file(s) (comma-separated for multiple)"
      echo "  --spec TEXT          What to review for (guides all workers)"
      echo ""
      echo "Options:"
      echo "  --passes N           Passes PER focus area (default: 2)"
      echo "  --session-name NAME  Custom tmux session name"
      echo "  --notify TARGET      Notify on completion (worker name or 'user')"
      echo "  --focus LIST         Comma-separated focus areas (overrides auto-detect)"
      echo "                       Diff: security,logic,error-handling,data-integrity,architecture,performance,ux-impact,completeness"
      echo "                       Content: correctness,completeness,feasibility,risks"
      echo "                       Mixed: security,logic,correctness,completeness,feasibility,risks"
      echo ""
      echo "Legacy aliases (still work):"
      echo "  --base BRANCH        Same as --scope BRANCH"
      echo "  --commit SHA         Same as --scope SHA"
      echo "  --uncommitted        Same as --scope uncommitted"
      echo "  --pr NUM             Same as --scope pr:NUM"
      echo ""
      echo "Examples:"
      echo "  --scope main                               diff since main (16 workers)"
      echo "  --content plan.md                          review plan (8 workers)"
      echo "  --scope main --content plan.md             diff + plan together (12 workers)"
      echo "  --scope main --spec 'check auth changes'   diff with custom focus"
      echo "  --passes 1 --focus security                1 worker, security only"
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

# ── Determine what we're reviewing ───────────────────────────
HAS_DIFF=false
HAS_CONTENT=false
[ -n "$SCOPE" ] && HAS_DIFF=true
[ -n "$CONTENT_FILES" ] && HAS_CONTENT=true

# Default: if nothing specified, review HEAD commit
if ! $HAS_DIFF && ! $HAS_CONTENT; then
  SCOPE="HEAD"
  HAS_DIFF=true
fi

# ── Resolve focus areas ──────────────────────────────────────
if [ -n "$CUSTOM_FOCUS" ]; then
  IFS=',' read -ra FOCUS_AREAS <<< "$CUSTOM_FOCUS"
elif $HAS_DIFF && $HAS_CONTENT; then
  FOCUS_AREAS=("${DEFAULT_MIXED_FOCUS[@]}")
elif $HAS_CONTENT; then
  FOCUS_AREAS=("${DEFAULT_CONTENT_FOCUS[@]}")
else
  FOCUS_AREAS=("${DEFAULT_DIFF_FOCUS[@]}")
fi

NUM_FOCUS=${#FOCUS_AREAS[@]}
TOTAL_WORKERS=$((PASSES_PER_FOCUS * NUM_FOCUS))

echo "Focus areas ($NUM_FOCUS): ${FOCUS_AREAS[*]}"
echo "Passes per focus: $PASSES_PER_FOCUS"
echo "Total workers: $TOTAL_WORKERS"

# ── Validate environment ─────────────────────────────────────
if ! tmux info &>/dev/null; then
  echo "ERROR: tmux not running" >&2; exit 1
fi

if [ ! -f "$TEMPLATE_DIR/worker-seed.md" ] || [ ! -f "$TEMPLATE_DIR/coordinator-seed.md" ]; then
  echo "ERROR: Templates not found at $TEMPLATE_DIR" >&2; exit 1
fi

cd "$PROJECT_ROOT"

# ── Build session name ───────────────────────────────────────
if [ -n "$CUSTOM_SESSION_NAME" ]; then
  REVIEW_SESSION="$CUSTOM_SESSION_NAME"
else
  WORKTREE_NAME=$(basename "$PROJECT_ROOT" | sed 's/^Wechat-w-//' | sed 's/^Wechat$/main/')

  if $HAS_CONTENT && ! $HAS_DIFF; then
    # Content-only: name from first file
    FIRST_FILE=$(echo "$CONTENT_FILES" | cut -d',' -f1)
    FILE_BASE=$(basename "$FIRST_FILE" | sed 's/\.[^.]*$//' | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//;s/-$//')
    CONTENT_HASH=$(echo "$CONTENT_FILES" | md5 2>/dev/null | cut -c1-8 || echo "$CONTENT_FILES" | md5sum 2>/dev/null | cut -c1-8 || echo "unknown")
    REVIEW_SESSION="dr-${WORKTREE_NAME}-${FILE_BASE}-${CONTENT_HASH}"
  else
    # Has diff (maybe also content)
    RESOLVED_REF="$SCOPE"
    if [ "$SCOPE" = "uncommitted" ]; then
      RESOLVED_REF=$(git rev-parse --short=8 HEAD 2>/dev/null || echo "wip")
    elif [[ "$SCOPE" == pr:* ]]; then
      RESOLVED_REF="pr${SCOPE#pr:}"
    fi
    COMMIT_MSG=$(git log -1 --format='%s' "$RESOLVED_REF" 2>/dev/null || echo "review")
    COMMIT_MSG=$(echo "$COMMIT_MSG" | sed 's/^[a-z]*([^)]*): *//' | sed 's/^[a-z]*: *//')
    FIRST_TWO=$(echo "$COMMIT_MSG" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//;s/-$//' | cut -d'-' -f1-2)
    SHORT_HASH=$(git rev-parse --short=8 "$RESOLVED_REF" 2>/dev/null || echo "$RESOLVED_REF")
    REVIEW_SESSION="dr-${WORKTREE_NAME}-${FIRST_TWO}-${SHORT_HASH}"
  fi
  REVIEW_SESSION="${REVIEW_SESSION:0:50}"
fi

# Kill existing session with same name
if tmux has-session -t "$REVIEW_SESSION" 2>/dev/null; then
  echo "Killing existing session: $REVIEW_SESSION"
  tmux kill-session -t "$REVIEW_SESSION"
fi

# ── Create session directory ─────────────────────────────────
SESSION_ID=$(date -u '+%Y%m%d-%H%M%S')
SESSION_DIR="$PROJECT_ROOT/.claude/state/deep-review/session-$SESSION_ID"
mkdir -p "$SESSION_DIR"
HISTORY_FILE="$PROJECT_ROOT/.claude/state/deep-review/history.jsonl"

echo "Session: $SESSION_DIR"

# ── Collect material (additive) ──────────────────────────────
MATERIAL_FILE="$SESSION_DIR/material-full.txt"
DIFF_DESC_PARTS=()
MATERIAL_TYPES=()

# 1. Diff (if scope provided)
if $HAS_DIFF; then
  echo "Generating diff..."
  DIFF_TMP="$SESSION_DIR/_diff.patch"

  # Auto-detect scope type
  if [ "$SCOPE" = "uncommitted" ]; then
    { git diff; git diff --cached; } > "$DIFF_TMP"
    for f in $(git ls-files --others --exclude-standard 2>/dev/null); do
      echo "diff --git a/$f b/$f" >> "$DIFF_TMP"
      echo "new file mode 100644" >> "$DIFF_TMP"
      echo "--- /dev/null" >> "$DIFF_TMP"
      echo "+++ b/$f" >> "$DIFF_TMP"
      sed 's/^/+/' "$f" >> "$DIFF_TMP" 2>/dev/null || true
    done
    DIFF_DESC_PARTS+=("uncommitted changes")

  elif [[ "$SCOPE" == pr:* ]]; then
    PR_NUM="${SCOPE#pr:}"
    gh pr diff "$PR_NUM" > "$DIFF_TMP"
    DIFF_DESC_PARTS+=("PR #$PR_NUM")

  elif git rev-parse --verify "$SCOPE^{commit}" &>/dev/null && \
       [ "$(git rev-parse "$SCOPE" 2>/dev/null)" != "$(git merge-base "$SCOPE" HEAD 2>/dev/null)" ]; then
    # It's a reachable commit that's an ancestor — treat as branch base
    # Try 3-dot first (changes on this branch only), fall back to 2-dot
    git diff "${SCOPE}...HEAD" > "$DIFF_TMP" 2>/dev/null || \
    git diff "${SCOPE}..HEAD" > "$DIFF_TMP" 2>/dev/null || true

    DIFF_LINES_TMP=$(wc -l < "$DIFF_TMP" | tr -d ' ')
    if [ "$DIFF_LINES_TMP" -eq 0 ]; then
      COMMITS_AHEAD=$(git rev-list "${SCOPE}..HEAD" --count 2>/dev/null || echo "0")
      if [ "$COMMITS_AHEAD" -gt 0 ]; then
        echo "WARN: $COMMITS_AHEAD commits ahead but tree content identical. Fallback to per-commit diffs..."
        for sha in $(git rev-list --reverse "${SCOPE}..HEAD"); do
          git show "$sha" >> "$DIFF_TMP" 2>/dev/null || true
        done
      fi
    fi
    DIFF_DESC_PARTS+=("changes since $SCOPE")

  else
    # Treat as specific commit
    git show "$SCOPE" > "$DIFF_TMP" 2>/dev/null || true
    DIFF_DESC_PARTS+=("commit $SCOPE")
  fi

  DIFF_LINES_TMP=$(wc -l < "$DIFF_TMP" | tr -d ' ')
  if [ "$DIFF_LINES_TMP" -gt 0 ]; then
    echo "═══ GIT DIFF ═══" >> "$MATERIAL_FILE"
    cat "$DIFF_TMP" >> "$MATERIAL_FILE"
    echo "" >> "$MATERIAL_FILE"
    MATERIAL_TYPES+=("diff")
    echo "  Diff: $DIFF_LINES_TMP lines"
  elif ! $HAS_CONTENT; then
    echo "ERROR: Empty diff and no content files — nothing to review" >&2
    rm -rf "$SESSION_DIR"
    exit 1
  else
    echo "  (diff is empty, reviewing content only)"
  fi
  rm -f "$DIFF_TMP"
fi

# 2. Content files (if provided)
if $HAS_CONTENT; then
  echo "Collecting content files..."
  IFS=',' read -ra _CONTENT_ARRAY <<< "$CONTENT_FILES"
  CONTENT_FILE_LIST=""
  for cf in "${_CONTENT_ARRAY[@]}"; do
    cf="${cf/#\~/$HOME}"
    if [ ! -f "$cf" ]; then
      echo "ERROR: Content file not found: $cf" >&2
      rm -rf "$SESSION_DIR"
      exit 1
    fi
    echo "  + $cf"
    echo "═══ FILE: $(basename "$cf") ═══" >> "$MATERIAL_FILE"
    cat "$cf" >> "$MATERIAL_FILE"
    echo "" >> "$MATERIAL_FILE"
    CONTENT_FILE_LIST="${CONTENT_FILE_LIST:+$CONTENT_FILE_LIST, }$(basename "$cf")"
  done
  DIFF_DESC_PARTS+=("$CONTENT_FILE_LIST")
  MATERIAL_TYPES+=("content")
fi

DIFF_DESC=$(IFS=' + '; echo "${DIFF_DESC_PARTS[*]}")
MATERIAL_TYPES_STR=$(IFS='+'; echo "${MATERIAL_TYPES[*]}")
[ -n "$REVIEW_SPEC" ] || REVIEW_SPEC="Review this material thoroughly for issues, gaps, and improvements."
DIFF_LINES=$(wc -l < "$MATERIAL_FILE" | tr -d ' ')
echo "Material: $DIFF_LINES lines ($DIFF_DESC)"

# ── Split material + generate randomized orderings ───────────
echo "Generating $TOTAL_WORKERS randomized orderings..."

python3 << 'PYEOF' - "$MATERIAL_FILE" "$SESSION_DIR" "$TOTAL_WORKERS"
import sys, os, random, json
from datetime import datetime, timezone

material_file = sys.argv[1]
session_dir = sys.argv[2]
num_workers = int(sys.argv[3])

with open(material_file) as f:
    content = f.read()

# Split into chunks at natural boundaries
chunks = []
current = []
for line in content.split('\n'):
    # Split at diff boundaries, section headers, or file markers
    if (line.startswith('diff --git ') or
        line.startswith('## ') or
        line.startswith('═══ ')) and current:
        chunks.append('\n'.join(current))
        current = []
    current.append(line)
if current:
    chunks.append('\n'.join(current))

# If content didn't split well, treat the whole thing as one chunk
if len(chunks) <= 1:
    chunks = [content]

print(f"  Split into {len(chunks)} chunks")

# Generate randomized orderings
for i in range(1, num_workers + 1):
    shuffled = chunks[:]
    random.shuffle(shuffled)
    outpath = os.path.join(session_dir, f'material-pass-{i}.txt')
    with open(outpath, 'w') as f:
        f.write('\n'.join(shuffled))

# Write session metadata
meta = {
    'session_id': os.path.basename(session_dir),
    'num_chunks': len(chunks),
    'num_workers': num_workers,
    'lines': content.count('\n'),
    'created_at': datetime.now(timezone.utc).isoformat()
}
with open(os.path.join(session_dir, 'meta.json'), 'w') as f:
    json.dump(meta, f, indent=2)
PYEOF

# ── Build focus assignment table ─────────────────────────────
FOCUS_LIST_CSV=$(IFS=','; echo "${FOCUS_AREAS[*]}")

# ── Generate seed prompts from templates ─────────────────────
echo "Generating seed prompts..."

for i in $(seq 1 "$TOTAL_WORKERS"); do
  FOCUS_IDX=$(( (i - 1) / PASSES_PER_FOCUS ))
  PASS_IN_FOCUS=$(( (i - 1) % PASSES_PER_FOCUS + 1 ))
  FOCUS="${FOCUS_AREAS[$FOCUS_IDX]}"

  sed \
    -e "s|{{PASS_NUMBER}}|$i|g" \
    -e "s|{{PASS_IN_FOCUS}}|$PASS_IN_FOCUS|g" \
    -e "s|{{PASSES_PER_FOCUS}}|$PASSES_PER_FOCUS|g" \
    -e "s|{{NUM_PASSES}}|$TOTAL_WORKERS|g" \
    -e "s|{{MATERIAL_FILE}}|$SESSION_DIR/material-pass-$i.txt|g" \
    -e "s|{{OUTPUT_FILE}}|$SESSION_DIR/findings-pass-$i.json|g" \
    -e "s|{{DONE_FILE}}|$SESSION_DIR/pass-$i.done|g" \
    -e "s|{{PROJECT_ROOT}}|$PROJECT_ROOT|g" \
    -e "s|{{SESSION_DIR}}|$SESSION_DIR|g" \
    -e "s|{{SPECIALIZATION}}|$FOCUS|g" \
    -e "s|{{SPEC}}|$REVIEW_SPEC|g" \
    "$TEMPLATE_DIR/worker-seed.md" > "$SESSION_DIR/worker-$i-seed.md"
done

sed \
  -e "s|{{SESSION_DIR}}|$SESSION_DIR|g" \
  -e "s|{{SESSION_ID}}|$SESSION_ID|g" \
  -e "s|{{PROJECT_ROOT}}|$PROJECT_ROOT|g" \
  -e "s|{{NUM_PASSES}}|$TOTAL_WORKERS|g" \
  -e "s|{{PASSES_PER_FOCUS}}|$PASSES_PER_FOCUS|g" \
  -e "s|{{NUM_FOCUS}}|$NUM_FOCUS|g" \
  -e "s|{{FOCUS_LIST}}|$FOCUS_LIST_CSV|g" \
  -e "s|{{REPORT_FILE}}|$SESSION_DIR/report.md|g" \
  -e "s|{{HISTORY_FILE}}|$HISTORY_FILE|g" \
  -e "s|{{NOTIFY_TARGET}}|$NOTIFY_TARGET|g" \
  -e "s|{{REVIEW_SESSION}}|$REVIEW_SESSION|g" \
  -e "s|{{DIFF_DESC}}|$DIFF_DESC|g" \
  -e "s|{{MATERIAL_TYPES}}|$MATERIAL_TYPES_STR|g" \
  "$TEMPLATE_DIR/coordinator-seed.md" > "$SESSION_DIR/coordinator-seed.md"

# ── Create launch wrappers ───────────────────────────────────
for i in $(seq 1 "$TOTAL_WORKERS"); do
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

# ── Create dedicated tmux session ────────────────────────────
NUM_WORKER_WINDOWS=$(( (TOTAL_WORKERS + 3) / 4 ))
echo "Creating tmux session: $REVIEW_SESSION (1 coordinator + $NUM_WORKER_WINDOWS worker windows)..."

tmux new-session -d -s "$REVIEW_SESSION" -n "coordinator" -c "$PROJECT_ROOT"

WORKERS_REMAINING=$TOTAL_WORKERS
for w in $(seq 1 "$NUM_WORKER_WINDOWS"); do
  PANES_IN_WINDOW=$((WORKERS_REMAINING > 4 ? 4 : WORKERS_REMAINING))
  tmux new-window -d -t "$REVIEW_SESSION" -n "workers-$w" -c "$PROJECT_ROOT"
  for _ in $(seq 1 $((PANES_IN_WINDOW - 1))); do
    tmux split-window -d -t "$REVIEW_SESSION:workers-$w" -c "$PROJECT_ROOT"
  done
  tmux select-layout -t "$REVIEW_SESSION:workers-$w" tiled
  WORKERS_REMAINING=$((WORKERS_REMAINING - PANES_IN_WINDOW))
done

sleep 1

# ── Launch workers (staggered) ───────────────────────────────
echo "Launching $TOTAL_WORKERS review workers across $NUM_FOCUS focus areas..."
echo ""

get_pane() {
  tmux list-panes -t "$1" -F '#{pane_id}' | sed -n "$((${2} + 1))p"
}

WORKER=1
for w in $(seq 1 "$NUM_WORKER_WINDOWS"); do
  PANE_COUNT=$(tmux list-panes -t "$REVIEW_SESSION:workers-$w" | wc -l | tr -d ' ')
  for p in $(seq 0 $((PANE_COUNT - 1))); do
    if [ "$WORKER" -gt "$TOTAL_WORKERS" ]; then break; fi
    PANE=$(get_pane "$REVIEW_SESSION:workers-$w" "$p")
    FOCUS_IDX=$(( (WORKER - 1) / PASSES_PER_FOCUS ))
    PASS_IN_FOCUS=$(( (WORKER - 1) % PASSES_PER_FOCUS + 1 ))
    echo "  Worker $WORKER → $PANE (win $w) [${FOCUS_AREAS[$FOCUS_IDX]} #$PASS_IN_FOCUS/$PASSES_PER_FOCUS]"
    tmux send-keys -t "$PANE" "bash '$SESSION_DIR/run-pass-$WORKER.sh'" Enter
    WORKER=$((WORKER + 1))
    sleep 0.3
  done
done

# ── Launch coordinator ───────────────────────────────────────
echo ""
echo "Launching coordinator..."
COORD_PANE=$(get_pane "$REVIEW_SESSION:coordinator" 0)
tmux send-keys -t "$COORD_PANE" "bash '$SESSION_DIR/run-coordinator.sh'" Enter

# ── Summary ──────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  DEEP REVIEW LAUNCHED"
echo ""
echo "  Session:     $REVIEW_SESSION"
echo "  Dir:         $SESSION_DIR"
echo "  Material:    $MATERIAL_TYPES_STR"
echo "  Reviewing:   $DIFF_DESC ($DIFF_LINES lines)"
if [ -n "$REVIEW_SPEC" ] && [ "$REVIEW_SPEC" != "Review this material thoroughly for issues, gaps, and improvements." ]; then
echo "  Spec:        $REVIEW_SPEC"
fi
echo ""
echo "  Focus areas ($NUM_FOCUS): ${FOCUS_AREAS[*]}"
echo "  Passes/focus: $PASSES_PER_FOCUS"
echo "  Total workers: $TOTAL_WORKERS (model: $WORKER_MODEL)"
echo "  Coordinator: $REVIEW_SESSION:coordinator (model: $COORD_MODEL)"
echo ""
for w in $(seq 1 "$NUM_WORKER_WINDOWS"); do
  FIRST=$((  (w - 1) * 4 + 1 ))
  LAST=$(( w * 4 ))
  if [ "$LAST" -gt "$TOTAL_WORKERS" ]; then LAST=$TOTAL_WORKERS; fi
  echo "  Window $w: workers $FIRST-$LAST (4 panes tiled)"
done
if [ -n "$NOTIFY_TARGET" ]; then
  echo ""
  echo "  Notify:      $NOTIFY_TARGET (on completion)"
fi
echo ""
echo "  Attach: tmux switch-client -t $REVIEW_SESSION"
echo "          tmux a -t $REVIEW_SESSION"
echo ""
echo "  Voting: ≥2/$PASSES_PER_FOCUS within each focus group"
echo "  Report: $SESSION_DIR/report.md"
echo "════════════════════════════════════════════════════════════"
