#!/bin/bash
# validate-findings.sh — Validates deep review findings JSON structure
# Exit 0 = valid, Exit 1 = invalid with details
# Usage: validate-findings.sh <file> [schema]
# Schemas: worker (default), coordinator, verifier
set -uo pipefail

FILE="$1"
SCHEMA="${2:-worker}"

if [ ! -f "$FILE" ]; then
  echo "ERROR: File not found: $FILE"
  exit 1
fi

if [ ! -s "$FILE" ]; then
  echo "ERROR: File is empty: $FILE"
  exit 1
fi

# Check valid JSON
if ! jq empty "$FILE" 2>/dev/null; then
  echo "ERROR: Not valid JSON"
  # Show first parse error
  jq empty "$FILE" 2>&1 | head -3
  exit 1
fi

ERRORS=""

case "$SCHEMA" in
  worker)
    # Top-level required fields
    MISSING=$(jq -r '
      [
        (if .pass == null then "pass" else empty end),
        (if .specialization == null then "specialization" else empty end),
        (if .completed_at == null then "completed_at" else empty end),
        (if (.findings | type) != "array" then "findings[]" else empty end),
        (if (.enumerated_paths | type) != "array" then "enumerated_paths[]" else empty end)
      ] | join(", ")
    ' "$FILE")
    [ -n "$MISSING" ] && ERRORS="${ERRORS}Missing top-level fields: $MISSING\n"

    # Check each finding has required fields
    BAD_FINDINGS=$(jq -r '
      [.findings // [] | to_entries[] | select(
        .value.location == null or .value.severity == null or .value.kind == null or
        .value.confidence == null or .value.title == null or .value.description == null
      ) | "  finding[\(.key)]: missing \([
        (if .value.location == null then "location" else empty end),
        (if .value.severity == null then "severity" else empty end),
        (if .value.kind == null then "kind" else empty end),
        (if .value.confidence == null then "confidence" else empty end),
        (if .value.title == null then "title" else empty end),
        (if .value.description == null then "description" else empty end)
      ] | join(", "))"] | join("\n")
    ' "$FILE")
    [ -n "$BAD_FINDINGS" ] && ERRORS="${ERRORS}Findings with missing fields:\n$BAD_FINDINGS\n"

    # Check severity values are valid
    BAD_SEVERITY=$(jq -r '
      [.findings // [] | .[].severity // "" |
        select(. != "" and . != "critical" and . != "high" and . != "medium" and . != "low" and . != "note")
      ] | unique | join(", ")
    ' "$FILE")
    [ -n "$BAD_SEVERITY" ] && ERRORS="${ERRORS}Invalid severity values: $BAD_SEVERITY (expected: critical|high|medium|low|note)\n"

    # Check confidence range [0, 1]
    BAD_CONFIDENCE=$(jq -r '
      [.findings // [] | to_entries[] |
        select(.value.confidence != null and (.value.confidence < 0 or .value.confidence > 1)) |
        "  finding[\(.key)]: confidence=\(.value.confidence)"
      ] | join("\n")
    ' "$FILE")
    [ -n "$BAD_CONFIDENCE" ] && ERRORS="${ERRORS}Confidence out of range [0,1]:\n$BAD_CONFIDENCE\n"

    # Check kind values are valid
    BAD_KIND=$(jq -r '
      [.findings // [] | .[].kind // "" |
        select(. != "" and . != "bug" and . != "security" and . != "performance" and
               . != "design" and . != "ux" and . != "completeness" and . != "improvement" and
               . != "gap" and . != "risk" and . != "error" and . != "ambiguity" and . != "alternative")
      ] | unique | join(", ")
    ' "$FILE")
    [ -n "$BAD_KIND" ] && ERRORS="${ERRORS}Invalid kind values: $BAD_KIND\n"
    ;;

  coordinator)
    # Coordinator writes report.md — validate it exists and has content
    if [ ! -s "$FILE" ]; then
      ERRORS="Report file is empty\n"
    fi
    # If it's a JSON file (e.g., candidates.json), validate structure
    if [[ "$FILE" == *.json ]]; then
      if ! jq 'type == "array"' "$FILE" > /dev/null 2>&1; then
        ERRORS="${ERRORS}Expected JSON array\n"
      fi
    fi
    ;;

  verifier)
    # Verifier results JSON
    MISSING=$(jq -r '
      [
        (if .verify_type == null then "verify_type" else empty end),
        (if .completed_at == null then "completed_at" else empty end),
        (if (.results | type) != "array" then "results[]" else empty end)
      ] | join(", ")
    ' "$FILE")
    [ -n "$MISSING" ] && ERRORS="${ERRORS}Missing top-level fields: $MISSING\n"

    # Check each result has required fields
    BAD_RESULTS=$(jq -r '
      [.results // [] | to_entries[] | select(
        .value.path_id == null or .value.status == null or .value.description == null
      ) | "  result[\(.key)]: missing \([
        (if .value.path_id == null then "path_id" else empty end),
        (if .value.status == null then "status" else empty end),
        (if .value.description == null then "description" else empty end)
      ] | join(", "))"] | join("\n")
    ' "$FILE")
    [ -n "$BAD_RESULTS" ] && ERRORS="${ERRORS}Results with missing fields:\n$BAD_RESULTS\n"

    # Check status values
    BAD_STATUS=$(jq -r '
      [.results // [] | .[].status // "" |
        select(. != "" and . != "pass" and . != "fail" and . != "skip" and . != "error")
      ] | unique | join(", ")
    ' "$FILE")
    [ -n "$BAD_STATUS" ] && ERRORS="${ERRORS}Invalid status values: $BAD_STATUS (expected: pass|fail|skip|error)\n"
    ;;

  judge)
    # Judge output: array of verdicts
    if ! jq 'type == "array"' "$FILE" > /dev/null 2>&1; then
      ERRORS="Expected JSON array of verdicts\n"
    else
      BAD_VERDICTS=$(jq -r '
        [to_entries[] | select(
          .value.finding_id == null or .value.verdict == null or
          .value.confidence == null or .value.reasoning == null
        ) | "  verdict[\(.key)]: missing \([
          (if .value.finding_id == null then "finding_id" else empty end),
          (if .value.verdict == null then "verdict" else empty end),
          (if .value.confidence == null then "confidence" else empty end),
          (if .value.reasoning == null then "reasoning" else empty end)
        ] | join(", "))"] | join("\n")
      ' "$FILE")
      [ -n "$BAD_VERDICTS" ] && ERRORS="${ERRORS}Verdicts with missing fields:\n$BAD_VERDICTS\n"
    fi
    ;;

  *)
    echo "ERROR: Unknown schema: $SCHEMA (expected: worker, coordinator, verifier, judge)"
    exit 1
    ;;
esac

if [ -n "$ERRORS" ]; then
  echo "INVALID"
  echo -e "$ERRORS"
  exit 1
fi

# Summary stats for valid output
case "$SCHEMA" in
  worker)
    FINDINGS_COUNT=$(jq '.findings | length' "$FILE")
    PATHS_COUNT=$(jq '.enumerated_paths | length' "$FILE")
    SPEC=$(jq -r '.specialization' "$FILE")
    echo "VALID — $SPEC: $FINDINGS_COUNT findings, $PATHS_COUNT paths"
    ;;
  verifier)
    RESULTS_COUNT=$(jq '.results | length' "$FILE")
    PASS_COUNT=$(jq '[.results[] | select(.status == "pass")] | length' "$FILE")
    echo "VALID — $RESULTS_COUNT results ($PASS_COUNT passed)"
    ;;
  judge)
    VERDICT_COUNT=$(jq 'length' "$FILE")
    CONFIRMED=$(jq '[.[] | select(.verdict == "confirmed")] | length' "$FILE")
    REJECTED=$(jq '[.[] | select(.verdict == "rejected")] | length' "$FILE")
    echo "VALID — $VERDICT_COUNT verdicts ($CONFIRMED confirmed, $REJECTED rejected)"
    ;;
  *)
    echo "VALID"
    ;;
esac
exit 0
