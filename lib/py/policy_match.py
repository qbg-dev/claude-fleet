#!/usr/bin/env python3
"""Match tool calls against policy.json context injections.

Reads hook JSON from stdin (tool_name, tool_input), loads an injections file,
and outputs matching context lines sorted by priority. Extracted from
pre-tool-context-injector.sh lines 77-153.
"""
import argparse
import json
import re
import sys


def main():
    parser = argparse.ArgumentParser(description="Match policy.json context injections")
    parser.add_argument("--injections", required=True, help="Path to injections file (policy.json or context-injections.json)")
    parser.add_argument("--prefix", default="", help="jq-style prefix into injections data (e.g. '.inject' or '')")
    parser.add_argument("--max", type=int, default=3, help="Max matches to output")
    args = parser.parse_args()

    try:
        hook_data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    tool_name = hook_data.get("tool_name", "")
    tool_input = hook_data.get("tool_input", {})
    if isinstance(tool_input, str):
        try:
            tool_input = json.loads(tool_input)
        except (json.JSONDecodeError, ValueError):
            tool_input = {}

    try:
        with open(args.injections) as f:
            raw = json.load(f)
        if args.prefix == ".inject":
            data = raw.get("inject", raw)
        else:
            data = raw
    except (OSError, json.JSONDecodeError, ValueError):
        sys.exit(0)

    matches = []

    # 1. File context -- match file_path in Write/Edit/Read tool inputs
    file_path = tool_input.get("file_path", "")
    if file_path and "file_context" in data:
        for pattern, info in data["file_context"].items():
            if pattern in file_path:
                inject_text = info if isinstance(info, str) else info.get("inject", "")
                priority = "medium" if isinstance(info, str) else info.get("priority", "medium")
                if inject_text:
                    matches.append((priority, inject_text))

    # 2. Command context -- match command in Bash tool inputs
    command = tool_input.get("command", "")
    if command and "command_context" in data:
        for pattern, info in data["command_context"].items():
            try:
                if re.search(pattern, command):
                    inject_text = info if isinstance(info, str) else info.get("inject", "")
                    priority = "medium" if isinstance(info, str) else info.get("priority", "medium")
                    if inject_text:
                        matches.append((priority, inject_text))
            except re.error:
                if pattern in command:
                    inject_text = info if isinstance(info, str) else info.get("inject", "")
                    if inject_text:
                        matches.append(("medium", inject_text))

    # 3. Tool context -- "always" items inject on every call; others match by tool_name
    if "tool_context" in data:
        for t_pattern, info in data["tool_context"].items():
            inject_when = info.get("inject_when", "always") if isinstance(info, dict) else "always"
            inject_text = info.get("inject", "") if isinstance(info, dict) else str(info)
            if not inject_text:
                continue
            if inject_when == "always":
                matches.append(("low", inject_text))
            elif tool_name and (t_pattern == tool_name or t_pattern in tool_name):
                matches.append(("medium", inject_text))

    if not matches:
        sys.exit(0)

    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    matches.sort(key=lambda x: priority_order.get(x[0], 2))

    seen = set()
    output_lines = []
    for _, text in matches[:args.max]:
        if text not in seen:
            seen.add(text)
            output_lines.append(f"- {text}")

    if output_lines:
        print("[Harness context]\n" + "\n".join(output_lines))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        sys.exit(0)
