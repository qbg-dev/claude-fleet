/**
 * Hooks bridge — thin dynamic import bridge to claude-hooks shared library.
 * Resolves CLAUDE_HOOKS_DIR at runtime (same pattern as all fleet packages).
 */
import { join } from "node:path";
import { existsSync } from "node:fs";

const HOME = process.env.HOME || "/tmp";

function resolveHooksDir(): string {
  return process.env.CLAUDE_HOOKS_DIR || join(HOME, ".claude-hooks");
}

/**
 * Get the hooks-io module (file I/O operations for hooks.json + script files).
 */
export async function getHooksIO() {
  const hooksDir = resolveHooksDir();
  const ioPath = join(hooksDir, "shared/hooks-io.ts");
  if (!existsSync(ioPath)) {
    throw new Error(`claude-hooks not installed at ${hooksDir}. Run: bash ~/.claude-hooks/scripts/install.sh`);
  }
  return await import(ioPath);
}

/**
 * Get the hooks types module.
 */
export async function getHooksTypes() {
  const hooksDir = resolveHooksDir();
  return await import(join(hooksDir, "shared/types"));
}

/**
 * Check that claude-hooks is installed (call at startup).
 */
export function checkHooksInstalled(): void {
  const hooksDir = resolveHooksDir();
  if (!existsSync(join(hooksDir, "shared/hooks-io.ts"))) {
    throw new Error(`claude-hooks not installed at ${hooksDir}. Run: bash ~/.claude-hooks/scripts/install.sh`);
  }
}
