#!/bin/bash

# Read JSON input from stdin
input=$(cat)

# Extract values from JSON (single jq call for performance)
eval "$(echo "$input" | jq -r '
  @sh "dir=\(.workspace.current_dir)",
  @sh "model=\(.model.display_name)",
  @sh "cost_raw=\(.cost.total_cost_usd // empty)",
  @sh "transcript_path=\(.transcript_path // empty)",
  @sh "session_id=\(.session_id // empty)"
')"

# ============================================================================
# PANE ↔ SESSION MAPPING
# ============================================================================
# Write pane_id → session_id link. Cached per session (pane doesn't change).
# Used by copy-resume-cmd.sh (C-x y) for instant lookup.
# ============================================================================
PANE_MAP_DIR="$HOME/.claude/pane-map"
if [ -n "$session_id" ] && [ "$session_id" != "null" ]; then
	map_file="$PANE_MAP_DIR/$session_id"
	# Resolve pane ID by walking PPID chain to a tmux pane
	_pane_id=$(tmux list-panes -a -F '#{pane_pid} #{pane_id}' 2>/dev/null | while read pid id; do
		p=$$; while [ "$p" -gt 1 ]; do
			[ "$p" = "$pid" ] && echo "$id" && break 2
			p=$(ps -o ppid= -p "$p" 2>/dev/null | tr -d ' ')
		done
	done)
	if [ -n "$_pane_id" ]; then
		# Check if mapping already correct (skip writes for performance)
		existing_pane=$(cat "$map_file" 2>/dev/null)
		if [ "$existing_pane" != "$_pane_id" ]; then
			mkdir -p "$PANE_MAP_DIR/by-pane"
			# Remove stale reverse mapping if pane changed
			[ -n "$existing_pane" ] && rm -f "$PANE_MAP_DIR/by-pane/$existing_pane"
			echo "$_pane_id" > "$map_file"
			echo "$session_id" > "$PANE_MAP_DIR/by-pane/$_pane_id"
		elif [ ! -f "$PANE_MAP_DIR/by-pane/$_pane_id" ]; then
			mkdir -p "$PANE_MAP_DIR/by-pane"
			echo "$session_id" > "$PANE_MAP_DIR/by-pane/$_pane_id"
		fi
	fi
fi

# ============================================================================
# PANE REGISTRY LOOKUP
# ============================================================================
# WORKER REGISTRY LOOKUP (unified registry.json)
# ============================================================================
# Find this pane's worker in registry.json by matching pane_id.
# Extracts: worker_name, parent, children count, status.
# ============================================================================
_reg_worker_name=""
_reg_parent=""
_reg_children_count=0
_reg_status=""
_reg_parent_pane=""

# Auto-detect registry.json from git worktree or cwd
_REGISTRY_FILE=""
if [ -n "$dir" ]; then
	_main_project="$dir"
	if [ -f "$dir/.git" ]; then
		_main_project=$(sed 's|gitdir: ||; s|/\.git/worktrees/.*||' "$dir/.git" 2>/dev/null)
	fi
	# resolve_registry: find canonical registry.json path
	# Use fleet's resolve-registry.sh if available, otherwise inline fallback
	if [ -f "$HOME/.claude-fleet/lib/resolve-registry.sh" ]; then
		source "$HOME/.claude-fleet/lib/resolve-registry.sh" 2>/dev/null
		_REGISTRY_FILE=$(resolve_registry "$_main_project" 2>/dev/null || echo "$_main_project/.claude/workers/registry.json")
	else
		# Minimal inline fallback (no fleet dependency)
		_sl_project_name="$(basename "$_main_project" | sed 's/-w-.*$//')"
		_sl_new_path="$HOME/.claude/fleet/$_sl_project_name/registry.json"
		_sl_old_path="$_main_project/.claude/workers/registry.json"
		if [ -f "$_sl_new_path" ]; then
			_REGISTRY_FILE="$_sl_new_path"
		elif [ -f "$_sl_old_path" ]; then
			_REGISTRY_FILE="$_sl_old_path"
		else
			_REGISTRY_FILE="$_sl_new_path"
		fi
	fi
fi

if [ -n "$_pane_id" ] && [ -f "$_REGISTRY_FILE" ]; then
	# Single jq call: find worker by pane_id, extract parent/children/status
	eval "$(jq -r --arg pid "$_pane_id" '
		to_entries[] | select(.key != "_config") | select(.value.pane_id == $pid) |
		@sh "_reg_worker_name=\(.key)",
		@sh "_reg_parent=\(.value.report_to // .value.parent // "")",
		@sh "_reg_children_count=\(.value.direct_reports // .value.children // [] | length)",
		@sh "_reg_status=\(.value.status // "")"
	' "$_REGISTRY_FILE" 2>/dev/null)"

	# Resolve parent's pane_id for display
	if [ -n "$_reg_parent" ]; then
		_reg_parent_pane=$(jq -r --arg p "$_reg_parent" '.[$p].pane_id // empty' "$_REGISTRY_FILE" 2>/dev/null)
	fi

	# ── Register active_session_id in registry (non-blocking, best-effort) ──
	if [ -n "$_reg_worker_name" ] && [ -n "$session_id" ] && [ "$session_id" != "null" ]; then
		_cur_sid=$(jq -r --arg n "$_reg_worker_name" '.[$n].active_session_id // empty' "$_REGISTRY_FILE" 2>/dev/null)
		if [ "$_cur_sid" != "$session_id" ]; then
			(
				_LOCK_DIR="${HOME}/.claude/statusline-locks/worker-registry"
				mkdir -p "$(dirname "$_LOCK_DIR")" 2>/dev/null || true
				_W=0; while ! mkdir "$_LOCK_DIR" 2>/dev/null; do sleep 0.2; _W=$((_W+1)); [ "$_W" -ge 5 ] && exit 0; done
				_tmp=$(mktemp)
				# Set active_session_id; append old session to past_session_ids (max 10)
				jq --arg n "$_reg_worker_name" --arg sid "$session_id" '
					.[$n].active_session_id as $old |
					.[$n].active_session_id = $sid |
					if $old and $old != "" and $old != $sid then
						.[$n].past_session_ids = ((.[$n].past_session_ids // []) + [$old] | .[-10:])
					else . end
				' "$_REGISTRY_FILE" > "$_tmp" 2>/dev/null && mv "$_tmp" "$_REGISTRY_FILE" || rm -f "$_tmp"
				rmdir "$_LOCK_DIR" 2>/dev/null || true
			) &
		fi
	fi
fi

# Legacy compatibility: set pane_line for old display code
PANE_REGISTRY="$_REGISTRY_FILE"
pane_line=""

# Get git information
git_branch=""
git_status=""
if [ -n "$dir" ]; then
	git_branch=$(cd "$dir" 2>/dev/null && git branch --show-current 2>/dev/null)
	if [ -n "$git_branch" ]; then
		# Skip git status if lock exists to avoid conflicts with other git operations
		if [ ! -f "$dir/.git/index.lock" ]; then
			git_status=$(cd "$dir" 2>/dev/null && git status --porcelain 2>/dev/null)
		fi
	fi
fi

# Format git info
git_info=""
if [ -n "$git_branch" ]; then
	if [ -n "$git_status" ]; then
		git_info=$(printf " 🌿 %b%s*%b" "\033[96m" "$git_branch" "\033[0m")
	else
		git_info=$(printf " 🌿 %b%s%b" "\033[96m" "$git_branch" "\033[0m")
	fi
fi

# Format cost with luxury tiers
cost_info=""
if [ -n "$cost_raw" ] && [ "$cost_raw" != "null" ]; then
	cost_dollars=$(awk "BEGIN{printf \"%.8f\", $cost_raw}")

	# Determine luxury tier (green→red heat map)
	if (($(echo "$cost_dollars <= 0.10" | bc -l))); then
		emoji="🪙"; color="\033[92m"
	elif (($(echo "$cost_dollars <= 1.00" | bc -l))); then
		emoji="💵"; color="\033[1;92m"
	elif (($(echo "$cost_dollars <= 5.00" | bc -l))); then
		emoji="💳"; color="\033[93m"
	elif (($(echo "$cost_dollars <= 20.00" | bc -l))); then
		emoji="✨"; color="\033[1;93m"
	elif (($(echo "$cost_dollars <= 100.00" | bc -l))); then
		emoji="🎉"; color="\033[91m"
	elif (($(echo "$cost_dollars <= 500.00" | bc -l))); then
		emoji="🎆"; color="\033[1;91m"
	else
		emoji="💎"; color="\033[1;91m"
	fi

	if (($(echo "$cost_dollars < 0.01" | bc -l))); then
		cost_display=$(printf "\$%.4f" "$cost_dollars")
	else
		cost_display=$(printf "\$%.2f" "$cost_dollars")
	fi

	cost_info=$(printf " | %s %b%s%b" "${emoji}" "${color}" "${cost_display}" "\033[0m")

	# ============================================================================
	# SPENDING TRACKER — write-time aggregation
	# ============================================================================
	# 1. Atomic append to spending.jsonl (archive, never read on hot path)
	# 2. Update spending-index.json (per-session min/max/ts, ~100KB)
	# Index is the hot-path data source; JSONL is append-only backup.
	# ============================================================================
	SPENDING_FILE="$HOME/.claude/spending.jsonl"
	SPENDING_INDEX="$HOME/.claude/spending-index.json"

	if [ -n "$session_id" ] && [ "$session_id" != "null" ]; then
		_now_ts=$(date +%s)

		# Atomic append to JSONL archive (unchanged)
		printf '{"sid":"%s","cost":%s,"ts":%s}\n' "$session_id" "$cost_dollars" "$_now_ts" >> "$SPENDING_FILE"

		# Update index for this session (mkdir spinlock, skip on contention)
		(
			_LOCK_DIR="$HOME/.claude/statusline-locks/spending-index"
			mkdir -p "$(dirname "$_LOCK_DIR")" 2>/dev/null || true
			_W=0; while ! mkdir "$_LOCK_DIR" 2>/dev/null; do sleep 0.2; _W=$((_W+1)); [ "$_W" -ge 5 ] && exit 0; done
			trap 'rmdir "$_LOCK_DIR" 2>/dev/null || true' EXIT

			# Bootstrap index if missing/corrupt
			if [ ! -f "$SPENDING_INDEX" ] || ! jq -e '.v' "$SPENDING_INDEX" >/dev/null 2>&1; then
				echo '{"v":1,"sessions":{}}' > "$SPENDING_INDEX"
			fi

			_tmp=$(mktemp)
			jq --arg sid "$session_id" --argjson cost "$cost_dollars" --argjson ts "$_now_ts" '
				.sessions[$sid] as $cur |
				if $cur then
					.sessions[$sid].max = (if $cost > $cur.max then $cost else $cur.max end) |
					.sessions[$sid].latest_ts = $ts
				else
					.sessions[$sid] = {min: $cost, max: $cost, first_ts: $ts, latest_ts: $ts}
				end
			' "$SPENDING_INDEX" > "$_tmp" 2>/dev/null && mv "$_tmp" "$SPENDING_INDEX" || rm -f "$_tmp"
		) &
	fi
fi

# ============================================================================
# COMPUTE SPENDING TOTALS (hourly / daily / weekly)
# ============================================================================
# Uses cumulative sum history for correct windowed totals.
# cumsum = lifetime total spend (sum of all session deltas). Only goes up.
# hourly = cumsum_now - cumsum_1h_ago (exactly what was spent in the window).
# History: one line per ~10s in spending-cumsum.tsv, pruned to 8 days.
# ============================================================================
spending_totals=""
SPENDING_INDEX="$HOME/.claude/spending-index.json"
SPENDING_TOTALS="$HOME/.claude/spending-totals.txt"
SPENDING_CUMSUM="$HOME/.claude/spending-cumsum.tsv"

if [ -f "$SPENDING_INDEX" ] || [ -f "$HOME/.claude/spending.jsonl" ]; then
	now_epoch=$(date +%s)
	hourly_total="0" daily_total="0" weekly_total="0"

	# Read cached totals
	_cache_fresh=0
	if [ -f "$SPENDING_TOTALS" ]; then
		read -r hourly_total daily_total weekly_total _cache_ts < "$SPENDING_TOTALS" 2>/dev/null || true
		if [ -n "$_cache_ts" ] && [ $(( now_epoch - _cache_ts )) -le 10 ]; then
			_cache_fresh=1
		fi
	fi

	if [ "$_cache_fresh" != 1 ]; then
		# Rebuild index from JSONL if index is missing/corrupt
		if [ ! -f "$SPENDING_INDEX" ] || ! jq -e '.v' "$SPENDING_INDEX" >/dev/null 2>&1; then
			if [ -x "$HOME/.claude/scripts/migrate-spending-index.sh" ]; then
				bash "$HOME/.claude/scripts/migrate-spending-index.sh" >/dev/null 2>&1
			fi
		fi

		# Compute current cumulative sum from index (~5ms on ~170KB)
		_cumsum="0"
		if [ -f "$SPENDING_INDEX" ]; then
			_cumsum=$(jq -r '
				[.sessions | to_entries[] | .value.max - .value.min] | add // 0 |
				. * 100 | round / 100
			' "$SPENDING_INDEX" 2>/dev/null || echo "0")
		fi

		# Append to cumsum history (atomic, <512 bytes)
		printf '%s\t%s\n' "$now_epoch" "$_cumsum" >> "$SPENDING_CUMSUM"

		# Compute windowed totals by looking up historical cumsum values
		# Find cumsum at ~1h, ~24h, ~7d ago via awk (single pass, fast on <60k lines)
		if [ -f "$SPENDING_CUMSUM" ]; then
			read -r hourly_total daily_total weekly_total < <(
				awk -v now="$now_epoch" -v cumsum="$_cumsum" '
				BEGIN { FS="\t"; h_ts=now-3600; d_ts=now-86400; w_ts=now-604800; h_v=0; d_v=0; w_v=0 }
				{
					ts=$1; v=$2
					# Track closest entry at or before each window boundary
					if (ts <= h_ts) h_v=v
					if (ts <= d_ts) d_v=v
					if (ts <= w_ts) w_v=v
				}
				END {
					h = cumsum - h_v; d = cumsum - d_v; w = cumsum - w_v
					# Round to 2 decimal places
					printf "%.2f %.2f %.2f\n", h, d, w
				}
				' "$SPENDING_CUMSUM"
			)
		fi

		# Cache the result
		printf '%s %s %s %s\n' "$hourly_total" "$daily_total" "$weekly_total" "$now_epoch" > "$SPENDING_TOTALS"

		# Prune cumsum history older than 8 days (keep buffer beyond 7d window)
		_prune_ts=$(( now_epoch - 691200 ))
		if [ -f "$SPENDING_CUMSUM" ] && [ "$(wc -l < "$SPENDING_CUMSUM")" -gt 70000 ]; then
			awk -v cutoff="$_prune_ts" -F'\t' '$1 >= cutoff' "$SPENDING_CUMSUM" > "${SPENDING_CUMSUM}.tmp" && \
				mv "${SPENDING_CUMSUM}.tmp" "$SPENDING_CUMSUM"
		fi
	fi

	# Warn if spending file exceeds 1GB
	_sf="$HOME/.claude/spending.jsonl"
	if [ -f "$_sf" ]; then
		_spending_size=$(stat -f%z "$_sf" 2>/dev/null || stat -c%s "$_sf" 2>/dev/null || echo 0)
		if [ "${_spending_size}" -gt 1073741824 ]; then
			spending_totals="⚠️ spending.jsonl > 1GB ($((_spending_size / 1048576))MB) — consider pruning"
		fi
	fi

	# Color helper: green < threshold1 < yellow < threshold2 < red
	color_tier() {
		local val="$1" lo="$2" hi="$3"
		if (($(echo "$val >= $hi" | bc -l 2>/dev/null || echo 0))); then
			echo "\033[1;91m"  # Bold Red
		elif (($(echo "$val >= $lo" | bc -l 2>/dev/null || echo 0))); then
			echo "\033[93m"    # Yellow
		else
			echo "\033[92m"    # Green
		fi
	}

	# Hourly (actual spend in last 60 min)
	if [ -n "$hourly_total" ] && [ "$hourly_total" != "0" ] && [ "$hourly_total" != "0.00" ]; then
		hc=$(color_tier "$hourly_total" 2.00 10.00)
		spending_totals=$(printf " ⏰ %b\$%s%b (1h)" "$hc" "$hourly_total" "\033[0m")
	fi

	# Daily (actual spend in last 24h)
	if [ -n "$daily_total" ] && [ "$daily_total" != "0" ] && [ "$daily_total" != "0.00" ]; then
		dc=$(color_tier "$daily_total" 5.00 20.00)
		spending_totals="${spending_totals}$(printf "  📅 %b\$%s%b (24h)" "$dc" "$daily_total" "\033[0m")"
	fi

	# Weekly (actual spend in last 7d)
	if [ -n "$weekly_total" ] && [ "$weekly_total" != "0" ] && [ "$weekly_total" != "0.00" ]; then
		wc=$(color_tier "$weekly_total" 30.00 100.00)
		spending_totals="${spending_totals}$(printf "  💰 %b\$%s%b (7d)" "$wc" "$weekly_total" "\033[0m")"
	fi
fi

# ============================================================================
# OUTPUT
# ============================================================================
dir_display="$(basename "$dir")"
model_colored=$(printf "%b%s%b" "\033[94m" "$model" "\033[0m")

# Detect if we're in a git worktree (worktrees have .git as a file, not a dir)
is_worktree=0
wt_display=""
if [ -n "$dir" ] && [ -f "$dir/.git" ]; then
	is_worktree=1
	_wt_name=$(basename "$dir")
	wt_display=$(printf "%b%s%b" "\033[1;97m" "$_wt_name" "\033[0m")
fi

# Check if this is a worker branch
is_worker=0
_worker_name=""
if [ -n "$git_branch" ]; then
	case "$git_branch" in worker/*) is_worker=1; _worker_name="${git_branch#worker/}" ;; esac
fi

# ============================================================================
# FLEET MAIL NAME LOOKUP
# ============================================================================
# Look up this session's fleet mail name from identity.json.
# Shows as 📬 in the statusline so the user knows their fleet identity.
# ============================================================================
_fleet_mail_name=""
_fleet_mail_display=""
if [ -n "$session_id" ] && [ "$session_id" != "null" ]; then
	_fleet_identity="$HOME/.claude/fleet/.sessions/$session_id/identity.json"
	if [ -f "$_fleet_identity" ]; then
		eval "$(jq -r '
			@sh "_fleet_mail_name=\(.mailName // "")",
			@sh "_fleet_custom_name=\(.customName // "")"
		' "$_fleet_identity" 2>/dev/null)"
		# Display: custom name if set, otherwise dirSlug-shortId
		if [ -n "$_fleet_custom_name" ] && [ "$_fleet_custom_name" != "session" ]; then
			_fleet_mail_display="$_fleet_custom_name"
		elif [ -n "$_fleet_mail_name" ]; then
			# Shorten: "session-ChengXing-Bot-e1f7ad79-..." → "ChengXing-Bot-e1f7ad79"
			_fleet_mail_display=$(echo "$_fleet_mail_name" | sed 's/^session-//; s/-\([0-9a-f]\{8\}\)-.*/–\1/')
		fi
	fi
fi

# ============================================================================
# FLEET V2 WORKER DETECTION
# ============================================================================
# Fleet v2 uses per-worker dirs at ~/.claude/fleet/{project}/{name}/.
# Match current dir against config.json worktree paths to find worker name.
# Uses grep first (fast) then jq only on the match (avoids 40+ jq calls).
# ============================================================================
_fleet_worker_name=""
if [ -n "$_pane_id" ] && [ -d "$HOME/.claude/fleet" ]; then
	# Match by pane_id in state.json (authoritative — only the registered pane shows as this worker)
	_fw_state=$(grep -rl "\"$_pane_id\"" "$HOME/.claude/fleet"/*/*/state.json 2>/dev/null | head -1)
	if [ -n "$_fw_state" ]; then
		_fw_pid=$(jq -r '.pane_id // empty' "$_fw_state" 2>/dev/null)
		if [ "$_fw_pid" = "$_pane_id" ]; then
			_fleet_worker_name=$(basename "$(dirname "$_fw_state")")
			is_worker=1
			[ -z "$_worker_name" ] && _worker_name="$_fleet_worker_name"
		fi
	fi
fi

# ============================================================================
# CURRENT TASK LOOKUP (workers only)
# ============================================================================
# Find the in_progress task from filesystem tasks.json.
# Worker name from git branch or registry pane_id match.
# ============================================================================
_task_line=""
# Use registry worker name if available, fall back to git branch
_effective_worker="${_reg_worker_name:-$_worker_name}"
if [ -n "$_effective_worker" ]; then
	_main_project="$dir"
	if [ -f "$dir/.git" ]; then
		_main_project=$(sed 's|gitdir: ||; s|/\.git/worktrees/.*||' "$dir/.git" 2>/dev/null)
	fi
	_tasks_file="$_main_project/.claude/workers/$_effective_worker/tasks.json"
	[ -f "$_tasks_file" ] && _task_line=$(jq -r '
		to_entries[] |
		select(.value.status == "in_progress") |
		"\(.key): \(.value.activeForm // .value.subject)"
	' "$_tasks_file" 2>/dev/null | head -1)
fi

# Determine tree role from unified registry.json or fleet v2
_tree_tag=""
if [ -n "$_reg_worker_name" ]; then
	if [ -n "$_reg_parent" ]; then
		# Child — show own name ← parent @ target
		_pr_ptarget=$(jq -r --arg p "$_reg_parent" '.[$p].pane_target // "-"' "$_REGISTRY_FILE" 2>/dev/null)
		_loc=""
		[ -n "$_pr_ptarget" ] && [ "$_pr_ptarget" != "-" ] && \
			_loc=$(printf " @ %b%s%b" "\033[36m" "$_pr_ptarget" "\033[0m")
		_tree_tag=$(printf "\n🔗 %b%s%b ← %b%s%b%s" "\033[1;97m" "$_reg_worker_name" "\033[0m" "\033[93m" "$_reg_parent" "\033[0m" "$_loc")
	elif [ "$_reg_children_count" -gt 0 ]; then
		# Root parent — show own name + children count
		_live=$(jq -r --arg name "$_reg_worker_name" '
			. as $reg | [$reg[$name].children // [] | .[] | select($reg[.].pane_id | type == "string")] | length
		' "$_REGISTRY_FILE" 2>/dev/null || echo "?")
		_tree_tag=$(printf "\n🔗 %b%s%b — %b%s%b children (%b%s%b live)" "\033[1;97m" "$_reg_worker_name" "\033[0m" "\033[93m" "$_reg_children_count" "\033[0m" "\033[92m" "$_live" "\033[0m")
	else
		# Registered but orphan — just show name
		_tree_tag=$(printf "\n🔗 %b%s%b" "\033[1;97m" "$_reg_worker_name" "\033[0m")
	fi
elif [ -n "$_fleet_worker_name" ]; then
	# Fleet v2 worker — show name (no registry hierarchy available)
	_tree_tag=$(printf "\n🔗 %b%s%b" "\033[1;97m" "$_fleet_worker_name" "\033[0m")
elif [ -n "$_fleet_mail_display" ]; then
	# Fleet mail registered (not a worker) — show mail identity
	_tree_tag=$(printf "\n📬 %b%s%b" "\033[36m" "$_fleet_mail_display" "\033[0m")
fi

if [ "$is_worker" = 1 ]; then
	# Worker line: 🔧 ParentRepo ↪ worktree 🌿 worker/name [child:1 ← parent @ w:1.0]  ⚙️ model | $cost
	_dir_part=""
	if [ "$is_worktree" = 1 ] && [ -n "$wt_display" ]; then
		_dir_part="$wt_display"
	else
		_dir_part=$(printf "%b%s%b" "\033[1;97m" "$dir_display" "\033[0m")
	fi
	printf "🔧 %s%s%s  ⚙️ %s%s" "$_dir_part" "$git_info" "$_tree_tag" "$model_colored" "$cost_info"
	# Current task (if any)
	if [ -n "$_task_line" ]; then
		printf "\n📋 %b%s%b" "\033[1;93m" "$_task_line" "\033[0m"
	fi
else
	# Non-worker line: 📁 dirname 🌿 branch  ⚙️ model | $cost
	_dir_part=""
	if [ "$is_worktree" = 1 ] && [ -n "$wt_display" ]; then
		_dir_part="$wt_display"
	else
		_dir_part="$dir_display"
	fi
	printf "📁 %s%s  ⚙️ %s%s" "$_dir_part" "$git_info" "$model_colored" "$cost_info"
	[ -n "$_tree_tag" ] && printf "%s" "$_tree_tag"
fi
if [ -n "$spending_totals" ]; then
	printf "\n%s" "$spending_totals"
fi

# Transcript path on separate line
if [ -n "$transcript_path" ] && [ "$transcript_path" != "null" ]; then
	transcript_name=$(basename "$transcript_path")
	session_name=""
	if [ -f "$transcript_path" ]; then
		session_name=$(grep '"type":"summary"' "$transcript_path" 2>/dev/null | tail -1 | jq -r '.summary // empty' 2>/dev/null)
	fi
	if [ -n "$session_name" ]; then
		name_colored=$(printf "%b%s%b" "\033[1;36m" "$session_name" "\033[0m")
		transcript_colored=$(printf "%b%s%b" "\033[36m" "$transcript_name" "\033[0m")
		printf "\n📝 %s — %s" "$name_colored" "$transcript_colored"
	else
		transcript_colored=$(printf "%b%s%b" "\033[36m" "$transcript_name" "\033[0m")
		printf "\n📝 %s" "$transcript_colored"
	fi
fi

# (Registry relationship now shown inline via _tree_tag above)
