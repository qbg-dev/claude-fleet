#!/usr/bin/env bun
/**
 * Install/update the watchdog launchd plist.
 * Replaces install.sh.
 */

import { writeFileSync } from "fs";
import { join } from "path";

const HOME = process.env.HOME!;
const PLIST_LABEL = "com.tmux-agents.watchdog";
const PLIST_PATH = join(HOME, "Library/LaunchAgents", `${PLIST_LABEL}.plist`);

const WATCHDOG_SCRIPT = join(__dirname, "watchdog.ts");
const LOG_PATH = join(HOME, ".tmux-agents/state/watchdog.log");
const PROJECT_ROOT = process.env.PROJECT_ROOT || process.cwd();

function generatePlist(): string {
  const bunPath = Bun.which("bun") || "/usr/local/bin/bun";

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>${bunPath}</string>
    <string>run</string>
    <string>${WATCHDOG_SCRIPT}</string>
  </array>

  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${HOME}</string>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:${HOME}/.bun/bin:${HOME}/.local/bin</string>
    <key>PROJECT_ROOT</key>
    <string>${PROJECT_ROOT}</string>
  </dict>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>

  <key>StandardOutPath</key>
  <string>${LOG_PATH}</string>

  <key>StandardErrorPath</key>
  <string>${LOG_PATH}</string>

  <key>ThrottleInterval</key>
  <integer>10</integer>
</dict>
</plist>`;
}

async function install(): Promise<void> {
  console.log("Installing watchdog launchd agent...");

  // Unload old plist if loaded
  const legacyLabel = "com.claude-fleet.harness-watchdog";
  for (const label of [PLIST_LABEL, legacyLabel]) {
    Bun.spawnSync(["launchctl", "bootout", `gui/${process.getuid!()}/${label}`], { stderr: "pipe" });
  }

  // Write plist
  const plist = generatePlist();
  writeFileSync(PLIST_PATH, plist);
  console.log(`Wrote ${PLIST_PATH}`);

  // Load
  const result = Bun.spawnSync(
    ["launchctl", "bootstrap", `gui/${process.getuid!()}`, PLIST_PATH],
    { stderr: "pipe" },
  );

  if (result.exitCode === 0) {
    console.log(`Loaded ${PLIST_LABEL}`);
  } else {
    // Try legacy load command
    const legacy = Bun.spawnSync(["launchctl", "load", PLIST_PATH], { stderr: "pipe" });
    if (legacy.exitCode === 0) {
      console.log(`Loaded ${PLIST_LABEL} (legacy method)`);
    } else {
      console.error(`Failed to load: ${result.stderr.toString()}`);
      process.exit(1);
    }
  }
}

// Run if executed directly
if (import.meta.main) {
  await install();
}

export { install, generatePlist, PLIST_LABEL, PLIST_PATH };
