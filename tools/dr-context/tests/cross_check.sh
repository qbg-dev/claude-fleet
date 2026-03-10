#!/usr/bin/env bash
# cross_check.sh — Verify Rust dr-context produces identical output to Python originals
#
# Runs both Python (inline heredocs extracted from deep-review.sh) and Rust
# on the same input, then diffs the JSON output. Any difference = test failure.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DR_CONTEXT="$SCRIPT_DIR/../target/release/dr-context"
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# Use the Wechat project as test input (real codebase)
PROJECT_ROOT="${1:-/Users/wz/Desktop/zPersonalProjects/Wechat-w-chief-of-staff}"

if [ ! -d "$PROJECT_ROOT/.git" ] && [ ! -f "$PROJECT_ROOT/.git" ]; then
  echo "ERROR: $PROJECT_ROOT is not a git repo"
  exit 1
fi

if [ ! -x "$DR_CONTEXT" ]; then
  echo "ERROR: Rust binary not found at $DR_CONTEXT — run 'cargo build --release' first"
  exit 1
fi

PASS=0
FAIL=0

check() {
  local name="$1" py_file="$2" rs_file="$3"
  # Sort JSON keys for stable comparison
  python3 -c "import json,sys; json.dump(json.load(open(sys.argv[1])),sys.stdout,sort_keys=True,indent=2)" "$py_file" > "$TMPDIR/py_sorted.json" 2>/dev/null || true
  python3 -c "import json,sys; json.dump(json.load(open(sys.argv[1])),sys.stdout,sort_keys=True,indent=2)" "$rs_file" > "$TMPDIR/rs_sorted.json" 2>/dev/null || true

  if diff -q "$TMPDIR/py_sorted.json" "$TMPDIR/rs_sorted.json" > /dev/null 2>&1; then
    echo "  ✓ $name — identical"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $name — DIFFER"
    diff --color "$TMPDIR/py_sorted.json" "$TMPDIR/rs_sorted.json" | head -30
    FAIL=$((FAIL + 1))
  fi
}

# ── Gather test inputs ──────────────────────────────────────────

# Pick a small set of changed files (last 5 commits)
CHANGED_FILES=$(cd "$PROJECT_ROOT" && git diff --name-only HEAD~5..HEAD 2>/dev/null | head -10)
if [ -z "$CHANGED_FILES" ]; then
  echo "WARN: No changed files in last 5 commits, using HEAD~1"
  CHANGED_FILES=$(cd "$PROJECT_ROOT" && git diff --name-only HEAD~1..HEAD 2>/dev/null | head -10)
fi

echo "=== Cross-check: Python vs Rust ==="
echo "Project: $PROJECT_ROOT"
echo "Changed files: $(echo "$CHANGED_FILES" | wc -l | tr -d ' ')"
echo ""

# ── 1. dep-graph ────────────────────────────────────────────────
echo "1. dep-graph"

# Python
python3 << 'DEPEOF' - "$PROJECT_ROOT" "$CHANGED_FILES" "$TMPDIR/dep-py.json"
import sys, json, os, subprocess, re

project_root = sys.argv[1]
changed_files = [f.strip() for f in sys.argv[2].strip().split('\n') if f.strip()]
out_path = sys.argv[3]

graph = {}
for cf in changed_files:
    entry = {"imported_by": [], "imports": [], "churn_30d": 0}
    basename = os.path.splitext(os.path.basename(cf))[0]
    try:
        result = subprocess.run(
            ["grep", "-rn", "--include=*.ts", "--include=*.tsx", "--include=*.js",
             f"from.*['\"].*{basename}['\"]", project_root],
            capture_output=True, text=True, timeout=10
        )
        for line in result.stdout.strip().split('\n'):
            if line and cf not in line:
                parts = line.split(':', 2)
                if len(parts) >= 2:
                    rel = os.path.relpath(parts[0], project_root)
                    entry["imported_by"].append(f"{rel}:{parts[1]}")
        entry["imported_by"] = entry["imported_by"][:20]
    except Exception:
        pass

    full_path = os.path.join(project_root, cf)
    if os.path.exists(full_path):
        try:
            with open(full_path) as f:
                content = f.read()
            imports = re.findall(r'from\s+[\'"]([^\'"]+)[\'"]', content)
            entry["imports"] = imports[:20]
        except Exception:
            pass

    try:
        result = subprocess.run(
            ["git", "log", "--oneline", "--since=30 days ago", "--", cf],
            capture_output=True, text=True, timeout=5, cwd=project_root
        )
        entry["churn_30d"] = len([l for l in result.stdout.strip().split('\n') if l])
    except Exception:
        pass

    graph[cf] = entry

with open(out_path, 'w') as f:
    json.dump(graph, f, indent=2)
DEPEOF

# Rust
"$DR_CONTEXT" dep-graph "$PROJECT_ROOT" "$CHANGED_FILES" "$TMPDIR/dep-rs.json" > /dev/null

check "dep-graph" "$TMPDIR/dep-py.json" "$TMPDIR/dep-rs.json"

# ── 2. test-coverage ────────────────────────────────────────────
echo "2. test-coverage"

# Python
python3 << 'TESTEOF' - "$PROJECT_ROOT" "$CHANGED_FILES" "$TMPDIR/cov-py.json"
import sys, json, os, glob

project_root = sys.argv[1]
changed_files = [f.strip() for f in sys.argv[2].strip().split('\n') if f.strip()]
out_path = sys.argv[3]

coverage = {}
for cf in changed_files:
    basename = os.path.splitext(os.path.basename(cf))[0]
    test_patterns = [
        f"**/tests/**/{basename}.test.*",
        f"**/tests/**/{basename}.spec.*",
        f"**/__tests__/{basename}.*",
        f"**/{basename}.test.*",
        f"**/{basename}.spec.*",
    ]
    found_tests = []
    for pattern in test_patterns:
        matches = glob.glob(os.path.join(project_root, pattern), recursive=True)
        for m in matches:
            found_tests.append(os.path.relpath(m, project_root))

    coverage[cf] = {
        "has_tests": len(found_tests) > 0,
        "test_files": found_tests[:5]
    }

with open(out_path, 'w') as f:
    json.dump(coverage, f, indent=2)
TESTEOF

# Rust
"$DR_CONTEXT" test-coverage "$PROJECT_ROOT" "$CHANGED_FILES" "$TMPDIR/cov-rs.json" > /dev/null

check "test-coverage" "$TMPDIR/cov-py.json" "$TMPDIR/cov-rs.json"

# ── 3. blame-context ────────────────────────────────────────────
echo "3. blame-context"

# Generate a diff material file
MATERIAL="$TMPDIR/material.txt"
(cd "$PROJECT_ROOT" && git diff HEAD~5..HEAD) > "$MATERIAL" 2>/dev/null || true

# Python
python3 << 'BLAMEEOF' - "$PROJECT_ROOT" "$MATERIAL" "$TMPDIR/blame-py.json"
import sys, json, os, subprocess, re

project_root = sys.argv[1]
material_file = sys.argv[2]
out_path = sys.argv[3]

with open(material_file) as f:
    content = f.read()

blame_data = {}
current_file = None
current_new_lines = []

for line in content.split('\n'):
    m = re.match(r'^diff --git a/(\S+)', line)
    if m:
        if current_file and current_new_lines:
            blame_data[current_file] = current_new_lines
        current_file = m.group(1)
        current_new_lines = []
        continue

    m = re.match(r'^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@', line)
    if m:
        start = int(m.group(1))
        count = int(m.group(2)) if m.group(2) else 1
        continue

if current_file and current_new_lines:
    blame_data[current_file] = current_new_lines

result = {}
for filepath in list(blame_data.keys())[:30]:
    full_path = os.path.join(project_root, filepath)
    if not os.path.exists(full_path):
        continue

    try:
        head_result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True, text=True, timeout=5, cwd=project_root
        )
        head_sha = head_result.stdout.strip()[:8]

        blame_result = subprocess.run(
            ["git", "blame", "--porcelain", filepath],
            capture_output=True, text=True, timeout=10, cwd=project_root
        )

        if blame_result.returncode == 0:
            new_lines = 0
            old_lines = 0
            for bl in blame_result.stdout.split('\n'):
                if bl.startswith('author-time '):
                    pass
                if len(bl) >= 40 and bl[0:8].isalnum():
                    sha = bl[:8]
                    if sha == head_sha or sha == '00000000':
                        new_lines += 1
                    else:
                        old_lines += 1

            result[filepath] = {
                "new_in_diff": new_lines,
                "pre_existing": old_lines,
                "ratio_new": round(new_lines / max(new_lines + old_lines, 1), 2)
            }
    except Exception:
        pass

with open(out_path, 'w') as f:
    json.dump(result, f, indent=2)
BLAMEEOF

# Rust
"$DR_CONTEXT" blame-context "$PROJECT_ROOT" "$MATERIAL" "$TMPDIR/blame-rs.json" > /dev/null

check "blame-context" "$TMPDIR/blame-py.json" "$TMPDIR/blame-rs.json"

# ── Summary ─────────────────────────────────────────────────────
echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -gt 0 ] && exit 1
exit 0
