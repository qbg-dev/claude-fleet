#!/usr/bin/env bash
# harness-gates.sh — Module: phase gates, wave gates, cycle enforcement.
# Sourced by stop-harness-dispatch.sh. Requires: harness-jq.sh, _SESSION_DIR, _file_mtime,
#   PROJECT_ROOT, PHASE_SKETCH_GATE_ENABLED, PHASE_GENERALIZATION_GATE_ENABLED,
#   PHASE2_CONTINUATION_ENABLED, WAVE_GATE_ENABLED, WAVE_REPORT_REQUIRED_SECTIONS,
#   MISSION_VISION_DISPLAY_LINES, CYCLE_GATE_ENABLED, CYCLE_PHASE_ENFORCEMENT,
#   CYCLE_PHASE_MIN_PROBE_SEC, CYCLE_GATE_REQUIRE_ACCEPTANCE, CYCLE_GATE_REQUIRE_JOURNAL.

# --- Resolve mission vision from harness.md ---
resolve_mission_vision() {
  local CANONICAL="$1"
  local HARNESS_MD=""
  if [ -f "$PROJECT_ROOT/.claude/harness/$CANONICAL/harness.md" ]; then
    HARNESS_MD="$PROJECT_ROOT/.claude/harness/$CANONICAL/harness.md"
  elif [ -f "$PROJECT_ROOT/claude_files/${CANONICAL}-harness.md" ]; then
    HARNESS_MD="$PROJECT_ROOT/claude_files/${CANONICAL}-harness.md"
  fi
  if [ -n "$HARNESS_MD" ] && [ -f "$HARNESS_MD" ]; then
    sed -n '/^## The World We Want$/,/^## /{/^## The World We Want$/d;/^## /d;p;}' "$HARNESS_MD" 2>/dev/null | sed '/^[[:space:]]*$/d' | head -$MISSION_VISION_DISPLAY_LINES
  fi
}

# --- Resolve spec file path ---
resolve_spec_file() {
  local CANONICAL="$1"
  if [ -f "$PROJECT_ROOT/.claude/harness/$CANONICAL/spec.md" ]; then
    echo ".claude/harness/$CANONICAL/spec.md"
  elif [ -f "$PROJECT_ROOT/claude_files/${CANONICAL}-spec.md" ]; then
    echo "claude_files/${CANONICAL}-spec.md"
  fi
}

# --- Phase 0 gate: Sketch must be approved before implementation ---
check_sketch_gate() {
  local HNAME="$1" PROGRESS="$2" MISSION="$3" MISSION_VISION="$4" DONE_COUNT="$5"
  [ "$PHASE_SKETCH_GATE_ENABLED" != "true" ] && return 1
  local SKETCH_APPROVED=$(jq -r '.sketch_approved // false' "$PROGRESS" 2>/dev/null || echo "false")
  [ "$SKETCH_APPROVED" = "true" ] && return 1
  [ "$DONE_COUNT" -ne 0 ] && return 1

  local CANONICAL="$HNAME"
  local MSG="## ${HNAME}: Phase 0 — Sketch Required\n\n"
  MSG="${MSG}**Mission:** ${MISSION}\n\n"
  [ -n "$MISSION_VISION" ] && MSG="${MSG}**The World We Want:**\n${MISSION_VISION}\n\n"
  MSG="${MSG}You must create and get approval for an HTML sketch before implementing anything.\n"
  MSG="${MSG}Follow the Phase 0 instructions from your seed prompt. Key steps:\n"
  MSG="${MSG}1. Create \`.claude/harness/${CANONICAL}/vision.html\`\n"
  MSG="${MSG}2. Open it for review: \`open .claude/harness/${CANONICAL}/vision.html\`\n"
  MSG="${MSG}3. Wait for user approval, then set \`\"sketch_approved\": true\`\n\n"
  MSG="${MSG}Escape: touch ${_SESSION_DIR}/allow-stop"
  hook_block "$(echo -e "$MSG")"
  exit 0
}

# --- Phase 0.5 gate: Generalizations must be approved ---
check_generalization_gate() {
  local HNAME="$1" PROGRESS="$2" MISSION="$3" DONE_COUNT="$4"
  [ "$PHASE_GENERALIZATION_GATE_ENABLED" != "true" ] && return 1
  local SKETCH_APPROVED=$(jq -r '.sketch_approved // false' "$PROGRESS" 2>/dev/null || echo "false")
  [ "$SKETCH_APPROVED" != "true" ] && return 1
  local GEN_APPROVED=$(jq -r '.generalization_approved // false' "$PROGRESS" 2>/dev/null || echo "false")
  [ "$GEN_APPROVED" = "true" ] && return 1
  [ "$DONE_COUNT" -ne 0 ] && return 1

  local CANONICAL="$HNAME"
  local GEN_FILE="$PROJECT_ROOT/.claude/harness/${CANONICAL}/generalizations.md"
  [ ! -f "$GEN_FILE" ] && GEN_FILE="$PROJECT_ROOT/claude_files/${CANONICAL}-generalizations.md"
  local GEN_REL=".claude/harness/${CANONICAL}/generalizations.md"
  local MSG="## ${HNAME}: Phase 0.5 — Generalizations Required\n\n"
  MSG="${MSG}**Mission:** ${MISSION}\n\n"
  MSG="${MSG}Your sketch is approved. Before implementing, propose 3-5 improvements beyond\n"
  MSG="${MSG}the seed waypoints. Follow the Phase 0.5 instructions from your seed prompt.\n"
  if [ ! -f "$GEN_FILE" ]; then
    MSG="${MSG}1. Write to \`${GEN_REL}\`\n"
    MSG="${MSG}2. Open for review + notify Warren\n"
    MSG="${MSG}3. Wait for approval, then set \`\"generalization_approved\": true\`\n"
  else
    MSG="${MSG}File exists: \`${GEN_REL}\`\n"
    MSG="${MSG}Awaiting user approval. Revise if they give feedback.\n"
    MSG="${MSG}Once approved: add tasks to tasks.json, set \`\"generalization_approved\": true\` in state.json\n"
  fi
  MSG="${MSG}\nEscape: touch ${_SESSION_DIR}/allow-stop"
  hook_block "$(echo -e "$MSG")"
  exit 0
}

# --- Wave gate enforcement ---
# Appends wave gate info to MSG variable (caller's). Returns nothing; caller checks MSG.
check_wave_gate() {
  local PROGRESS="$1" HNAME="$2" SPEC_FILE="$3"
  # Output goes to stdout, caller captures via $()
  [ "$WAVE_GATE_ENABLED" != "true" ] && return

  local WAVE_BOUNDARY=$(harness_is_wave_boundary "$PROGRESS" 2>/dev/null || echo "false")
  local ACTIONABLE_GATE=""
  ACTIONABLE_GATE=$(jq -r '
    . as $root |
    [.tasks | to_entries[] | select(
      .value.status == "pending" and
      (.value.metadata.wave_gate == true) and
      ((.value.blockedBy // []) as $deps |
       if ($deps | length) == 0 then true
       else [$deps[] as $dep | ($root.tasks[$dep].status // "missing")] | all(. == "completed")
       end)
    ) | .key] | first // ""
  ' "$PROGRESS" 2>/dev/null || echo "")

  [ "$WAVE_BOUNDARY" != "true" ] && [ -z "$ACTIONABLE_GATE" ] && return

  local WAVE_NUM="?" WAVE_NAME="" REPORT_PATH=""
  if [ -n "$ACTIONABLE_GATE" ]; then
    WAVE_NUM=$(jq -r --arg g "$ACTIONABLE_GATE" '.tasks[$g].metadata.wave_number // "?"' "$PROGRESS" 2>/dev/null || echo "?")
    WAVE_NAME=$(jq -r --arg g "$ACTIONABLE_GATE" '.tasks[$g].metadata.wave_name // ""' "$PROGRESS" 2>/dev/null || echo "")
  elif [ "$WAVE_BOUNDARY" = "true" ]; then
    local WAVE_JSON=$(harness_current_wave "$PROGRESS" 2>/dev/null || echo "null")
    WAVE_NUM=$(echo "$WAVE_JSON" | jq -r '.id // "?"' 2>/dev/null || echo "?")
  fi
  REPORT_PATH=$(harness_wave_report_path "$PROGRESS" "$WAVE_NUM" 2>/dev/null || echo "")

  local WMSG="\n**WAVE ${WAVE_NUM} COMPLETE**${WAVE_NAME:+ (${WAVE_NAME})}\n"
  [ -n "$SPEC_FILE" ] && WMSG="${WMSG}**Spec check**: Re-read \`${SPEC_FILE}\` — did you miss anything? Document deviations.\n"
  WMSG="${WMSG}1. Re-read the mission. Does each task result serve it?\n"
  WMSG="${WMSG}2. Commit: \`feat(${HNAME}): wave ${WAVE_NUM} — <name>\`\n"
  WMSG="${WMSG}3. Deploy + inspect via Chrome + take screenshots\n"
  WMSG="${WMSG}4. Copy starter: \`cp ~/.claude-ops/templates/wave-report-starter.html ${REPORT_PATH:-~/.claude-ops/harness/reports/${HNAME}/wave-${WAVE_NUM}.html}\`\n"
  WMSG="${WMSG}5. Edit the report — replace placeholder comments with real content\n"
  WMSG="${WMSG}6. Open: \`open ${REPORT_PATH:-~/.claude-ops/harness/reports/${HNAME}/wave-${WAVE_NUM}.html}\`\n"
  WMSG="${WMSG}7. Notify Warren: \`notify \"Wave ${WAVE_NUM} done\" \"${HNAME}\" \"${REPORT_PATH:-~/.claude-ops/harness/reports/${HNAME}/wave-${WAVE_NUM}.html}\"\`\n"
  [ -n "$ACTIONABLE_GATE" ] && WMSG="${WMSG}8. Mark gate \`${ACTIONABLE_GATE}\` completed in config.json\n"

  # Hard gate: block if report missing or lacks required sections
  if [ -n "$REPORT_PATH" ] && [ ! -f "$REPORT_PATH" ]; then
    WMSG="${WMSG}\n**WAVE GATE**: No report found at ${REPORT_PATH}.\n"
    WMSG="${WMSG}Report MUST include: ${WAVE_REPORT_REQUIRED_SECTIONS}. Cannot proceed without it.\n"
  elif [ -n "$REPORT_PATH" ] && [ -f "$REPORT_PATH" ]; then
    IFS=',' read -ra _wave_sections <<< "$WAVE_REPORT_REQUIRED_SECTIONS"
    for _ws in "${_wave_sections[@]}"; do
      _ws=$(echo "$_ws" | sed 's/^ *//;s/ *$//')
      local _ws_dash=$(echo "$_ws" | tr ' ' '-')
      if ! grep -qi "${_ws}\|${_ws_dash}" "$REPORT_PATH" 2>/dev/null; then
        WMSG="${WMSG}\n**WAVE GATE**: Report missing ${_ws} section.\n"
      fi
    done
  fi

  echo -e "$WMSG"
}

# --- Cycle gate: enforce MEMORY.md update + state.json bump for long-running harnesses ---
check_cycle_gate() {
  local PROGRESS="$1" CANONICAL="$2" CURRENT="$3"
  local LIFECYCLE=$(harness_lifecycle "$PROGRESS")
  local CYCLE_GATE_ENABLED="${CYCLE_GATE_ENABLED:-true}"
  local CYCLE_GATE_REQUIRE_ACCEPTANCE="${CYCLE_GATE_REQUIRE_ACCEPTANCE:-true}"
  local CYCLE_GATE_REQUIRE_MEMORY="${CYCLE_GATE_REQUIRE_MEMORY:-true}"

  [ "$CYCLE_GATE_ENABLED" != "true" ] && return
  [ "$LIFECYCLE" != "long-running" ] && return
  [ "$CURRENT" != "ALL_DONE" ] && return

  local LAST_CYCLE_AT=$(harness_last_cycle_at "$PROGRESS")
  [ "$LAST_CYCLE_AT" = "null" ] && return

  local ACCEPTANCE_MISSING=false MEMORY_MISSING=false
  local HARNESS_DIR_PATH="$PROJECT_ROOT/.claude/harness/$CANONICAL"

  if [ "$CYCLE_GATE_REQUIRE_ACCEPTANCE" = "true" ]; then
    local ACC_FILE="$HARNESS_DIR_PATH/acceptance.md"
    if [ -f "$ACC_FILE" ]; then
      local ACC_MTIME=$(_file_mtime "$ACC_FILE")
      local CYCLE_EPOCH=$(iso_to_epoch "$LAST_CYCLE_AT")
      [ "$ACC_MTIME" -le "$CYCLE_EPOCH" ] && ACCEPTANCE_MISSING=true
    fi
    # No acceptance.md in v3 — merged into mission.md Constraints section; skip if absent
  fi

  if [ "$CYCLE_GATE_REQUIRE_MEMORY" = "true" ]; then
    # Check that MEMORY.md was updated this cycle (mtime > last_cycle_at)
    # Try module-manager (current), fall back to sidecar (legacy)
    local _mem_base="$HARNESS_DIR_PATH/agents/sidecar"
    [ -d "$HARNESS_DIR_PATH/agents/module-manager" ] && _mem_base="$HARNESS_DIR_PATH/agents/module-manager"
    local MEM_FILE="$_mem_base/MEMORY.md"
    [ ! -f "$MEM_FILE" ] && MEM_FILE="$_mem_base/memory.md"
    if [ -f "$MEM_FILE" ]; then
      local MEM_MTIME=$(_file_mtime "$MEM_FILE")
      local CYCLE_EPOCH=$(iso_to_epoch "$LAST_CYCLE_AT")
      [ "$MEM_MTIME" -le "$CYCLE_EPOCH" ] && MEMORY_MISSING=true
    fi
    # If no MEMORY.md at all, skip (new harness)
  fi

  local GMSG=""
  if [ "$ACCEPTANCE_MISSING" = "true" ] && [ "$MEMORY_MISSING" = "true" ]; then
    GMSG="\n**CYCLE GATE BLOCKED**: Both acceptance.md and MEMORY.md need updating.\n"
    GMSG="${GMSG}- Update acceptance.md (or mission.md Constraints) with probe results.\n"
    GMSG="${GMSG}- Update MEMORY.md with key learnings from this cycle.\n"
  elif [ "$ACCEPTANCE_MISSING" = "true" ]; then
    GMSG="\n**CYCLE GATE WARNING**: acceptance.md not updated since last cycle (${LAST_CYCLE_AT}).\n"
    GMSG="${GMSG}Update it with your probe results before generating new tasks.\n"
  elif [ "$MEMORY_MISSING" = "true" ]; then
    GMSG="\n**CYCLE GATE WARNING**: MEMORY.md not updated since last cycle (${LAST_CYCLE_AT}).\n"
    GMSG="${GMSG}Synthesize key learnings into MEMORY.md before generating new tasks.\n"
  fi
  echo -e "$GMSG"
}

# --- Cycle phase enforcement (PROBE→RECONCILE→ACT→PERSIST ordering) ---
check_cycle_phase() {
  local PROGRESS="$1" CANONICAL="$2"
  local LIFECYCLE=$(harness_lifecycle "$PROGRESS")
  local CYCLE_PHASE_ENFORCEMENT="${CYCLE_PHASE_ENFORCEMENT:-true}"
  local CYCLE_PHASE_MIN_PROBE_SEC="${CYCLE_PHASE_MIN_PROBE_SEC:-60}"

  [ "$CYCLE_PHASE_ENFORCEMENT" != "true" ] && return
  [ "$LIFECYCLE" != "long-running" ] && return

  local CUR_PHASE=$(harness_cycle_phase "$PROGRESS")
  local PHASE_ENTERED=$(harness_phase_entered_at "$PROGRESS")
  local HARNESS_DIR_PHASE="$PROJECT_ROOT/.claude/harness/$CANONICAL"

  [ "$CUR_PHASE" = "unknown" ] && return

  local PHASE_WARN=""
  local NOW_EPOCH=$(date +%s)

  case "$CUR_PHASE" in
    probe)
      local ACC_FILE_P="$HARNESS_DIR_PHASE/acceptance.md"
      if [ -f "$ACC_FILE_P" ] && [ "$PHASE_ENTERED" != "0" ]; then
        local ACC_MT=$(_file_mtime "$ACC_FILE_P")
        local PE_EPOCH="$PHASE_ENTERED"
        if echo "$PHASE_ENTERED" | grep -qE '^[0-9]{4}-'; then
          PE_EPOCH=$(iso_to_epoch "$PHASE_ENTERED")
        fi
        if [ "$ACC_MT" -le "$PE_EPOCH" ] 2>/dev/null; then
          PHASE_WARN="**PHASE GATE [PROBE]**: Update acceptance.md with probe results before advancing to RECONCILE."
        fi
        local IN_PHASE_SEC=$(( NOW_EPOCH - PE_EPOCH ))
        if [ "$IN_PHASE_SEC" -lt "$CYCLE_PHASE_MIN_PROBE_SEC" ] 2>/dev/null; then
          PHASE_WARN="${PHASE_WARN:+$PHASE_WARN\n}**PHASE GATE [PROBE]**: Only ${IN_PHASE_SEC}s in PROBE (min: ${CYCLE_PHASE_MIN_PROBE_SEC}s). Spend more time probing."
        fi
      fi
      ;;
    reconcile)
      local GAPS_DOC=$(jq -r '.current_session.phase_artifacts.reconcile.gaps_documented // false' "$PROGRESS" 2>/dev/null || echo "false")
      [ "$GAPS_DOC" != "true" ] && PHASE_WARN="**PHASE GATE [RECONCILE]**: Set \`current_session.phase_artifacts.reconcile.gaps_documented = true\` after documenting gaps before advancing to ACT."
      ;;
    act)
      local TASKS_CREATED=$(jq -r '.current_session.phase_artifacts.act.tasks_created // 0' "$PROGRESS" 2>/dev/null || echo "0")
      local FILES_CHANGED=$(jq -r '.current_session.phase_artifacts.act.files_changed // 0' "$PROGRESS" 2>/dev/null || echo "0")
      [ "$TASKS_CREATED" -eq 0 ] && [ "$FILES_CHANGED" -eq 0 ] 2>/dev/null && PHASE_WARN="**PHASE GATE [ACT]**: No work recorded. Update \`current_session.phase_artifacts.act\` (tasks_created or files_changed) before advancing to PERSIST."
      ;;
    persist)
      # v3: check MEMORY.md was updated this cycle; no journal.md requirement
      local _mem_base_p="$HARNESS_DIR_PHASE/agents/sidecar"
      [ -d "$HARNESS_DIR_PHASE/agents/module-manager" ] && _mem_base_p="$HARNESS_DIR_PHASE/agents/module-manager"
      local MEM_P="$_mem_base_p/MEMORY.md"
      [ ! -f "$MEM_P" ] && MEM_P="$_mem_base_p/memory.md"
      local CYCLE_N=$(harness_cycle_count "$PROGRESS")
      local LAST_AT=$(harness_last_cycle_at "$PROGRESS")
      if [ -f "$MEM_P" ] && [ "$LAST_AT" != "null" ] && [ "$LAST_AT" != "0" ]; then
        local MEM_MT=$(_file_mtime "$MEM_P")
        local LAST_EP=$(iso_to_epoch "$LAST_AT")
        [ "$MEM_MT" -le "$LAST_EP" ] && PHASE_WARN="**PHASE GATE [PERSIST]**: MEMORY.md not updated this cycle. Synthesize key learnings before stopping."
      fi
      # Also bump state.json cycle counter
      PHASE_WARN="${PHASE_WARN:+$PHASE_WARN\n}**PERSIST checklist**: Update MEMORY.md → call harness_bump_session (or update state.json manually) → stop."
      ;;
  esac

  [ -n "$PHASE_WARN" ] && echo -e "$PHASE_WARN"
  echo "**Phase:** ${CUR_PHASE} | Update \`current_session.cycle_phase\` to advance: probe→reconcile→act→persist→probe"
}

# --- Phase 2 + long-running cycle continuation ---
check_continuation() {
  local PROGRESS="$1" HNAME="$2" MISSION="$3" MISSION_VISION="$4" CURRENT="$5"
  local LIFECYCLE=$(harness_lifecycle "$PROGRESS")
  local CANONICAL="$HNAME"

  # Long-running: generate next cycle
  if [ "$LIFECYCLE" = "long-running" ] && [ "$CURRENT" = "ALL_DONE" ]; then
    local CYCLE_COUNT=$(harness_cycle_count "$PROGRESS")
    local NEXT_CYCLE=$((CYCLE_COUNT + 1))
    local CMSG="\n---\n## Cycle ${CYCLE_COUNT} Complete — Advancing the Mission\n\n"
    CMSG="${CMSG}**Mission:** ${MISSION}\n\n"
    [ -n "$MISSION_VISION" ] && CMSG="${CMSG}**The World We Want:**\n${MISSION_VISION}\n\n"
    CMSG="${CMSG}All current tasks finished. Generate the next cycle:\n\n"
    CMSG="${CMSG}1. **Assess** — What is the current state of the system relative to the mission?\n"
    CMSG="${CMSG}2. **Identify gaps** — What's missing, degraded, drifted, or could be improved?\n"
    CMSG="${CMSG}3. **Generate 3-5 new tasks** — Add them to tasks.json\n"
    CMSG="${CMSG}4. **Update cycle** — Set \`cycles_completed\` to ${NEXT_CYCLE} and \`last_cycle_at\` to now in state.json.\n"
    CMSG="${CMSG}5. **Start working** — Pick the highest-priority new task and begin.\n\n"
    CMSG="${CMSG}The mission is never done. Each cycle should leave the system measurably closer to the vision.\n"
    echo -e "$CMSG"
    return
  fi

  # Phase 2: one-shot harnesses
  if [ "$PHASE2_CONTINUATION_ENABLED" = "true" ] && [ "$CURRENT" = "ALL_DONE" ]; then
    local HAS_MISSION_COMPLETE=$(jq -r '
      [(.learnings // [])[] | select(. | test("mission.complete"; "i"))] | length
    ' "$PROGRESS" 2>/dev/null || echo "0")

    if [ "$HAS_MISSION_COMPLETE" -eq 0 ]; then
      local CMSG="\n---\n## Phase 2: Seed Tasks Complete — The Real Work Begins\n\n"
      CMSG="${CMSG}All seed waypoints done. Follow Phase 2 from your seed prompt:\n"
      CMSG="${CMSG}1. Re-read the mission\n"
      CMSG="${CMSG}2. Experience the system as a user\n"
      CMSG="${CMSG}3. Find at least 3 gaps, create a new wave\n"
      CMSG="${CMSG}4. Do NOT stop. The mission is the target, not the task list.\n"
      echo -e "$CMSG"
    else
      echo -e "\n---\n**Mission verified.** You wrote a mission-complete learnings entry.\nSet status to \"done\" if the world matches the vision, or keep going.\n"
    fi
  fi
}
