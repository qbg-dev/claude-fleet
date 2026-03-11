/**
 * Context pre-pass: static analysis, dependency graph, test coverage, blame.
 * All best-effort — failures never abort the review.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { MaterialResult, SessionContext } from "./types";

/** Run the full context pre-pass (static analysis + dr-context tools) */
export function runContextPrePass(ctx: SessionContext, material: MaterialResult): void {
  if (material.changedFiles.length === 0) return;

  console.log("Gathering context for changed files...");
  const changedFiles = material.changedFiles.join("\n");
  const drContext = join(ctx.claudeOps, "bin", "dr-context");

  try {
    // 1. Static analysis
    runStaticAnalysis(ctx, material);

    // 2. Dependency graph
    if (existsSync(drContext)) {
      console.log("  Building dependency graph...");
      const depFile = join(ctx.sessionDir, "dep-graph.json");
      Bun.spawnSync([drContext, "dep-graph", ctx.projectRoot, changedFiles, depFile], {
        cwd: ctx.projectRoot,
        stderr: "pipe",
      });

      // 3. Test coverage
      console.log("  Checking test coverage...");
      const testFile = join(ctx.sessionDir, "test-coverage.json");
      Bun.spawnSync([drContext, "test-coverage", ctx.projectRoot, changedFiles, testFile], {
        cwd: ctx.projectRoot,
        stderr: "pipe",
      });

      // 4. Blame context
      console.log("  Building blame context...");
      const blameFile = join(ctx.sessionDir, "blame-context.json");
      Bun.spawnSync([drContext, "blame-context", ctx.projectRoot, material.materialFile, blameFile], {
        cwd: ctx.projectRoot,
        stderr: "pipe",
      });
    }

    console.log("  Context gathering complete.");
  } catch {
    console.log("  WARN: Context pre-pass had errors (non-fatal, continuing)");
  }
}

/** Run static analysis — tries oxlint > biome > tsc in order */
function runStaticAnalysis(ctx: SessionContext, material: MaterialResult): void {
  console.log("  Running static analysis...");
  const saFile = join(ctx.sessionDir, "static-analysis.txt");
  let toolUsed = "";

  const tsFiles = material.changedFiles.filter((f) => /\.(ts|tsx|js|jsx)$/.test(f));

  // Try oxlint
  if (!toolUsed && tsFiles.length > 0) {
    const which = Bun.spawnSync(["which", "oxlint"], { stderr: "pipe" });
    if (which.exitCode === 0) {
      const result = Bun.spawnSync(["oxlint", "--quiet", ...tsFiles], {
        cwd: ctx.projectRoot,
        stderr: "pipe",
        timeout: 15_000,
      });
      writeFileSync(saFile, result.stdout.toString());
      toolUsed = "oxlint";
    }
  }

  // Try biome
  if (!toolUsed) {
    const jsJsonFiles = material.changedFiles.filter((f) => /\.(ts|tsx|js|jsx|json)$/.test(f));
    if (jsJsonFiles.length > 0) {
      const which = Bun.spawnSync(["which", "biome"], { stderr: "pipe" });
      if (which.exitCode === 0) {
        const result = Bun.spawnSync(["biome", "check", "--no-errors-on-unmatched", ...jsJsonFiles], {
          cwd: ctx.projectRoot,
          stderr: "pipe",
          timeout: 20_000,
        });
        writeFileSync(saFile, result.stdout.toString());
        toolUsed = "biome";
      }
    }
  }

  // Fallback to tsc
  if (!toolUsed && existsSync(join(ctx.projectRoot, "tsconfig.json"))) {
    const which = Bun.spawnSync(["which", "npx"], { stderr: "pipe" });
    if (which.exitCode === 0) {
      const result = Bun.spawnSync(["npx", "tsc", "--noEmit"], {
        cwd: ctx.projectRoot,
        stderr: "pipe",
        timeout: 30_000,
      });
      const tscOut = result.stdout.toString() + result.stderr.toString();
      // Filter to only errors in changed files
      const filtered = material.changedFiles
        .flatMap((f) => tscOut.split("\n").filter((l) => l.includes(f)))
        .join("\n");
      writeFileSync(saFile, filtered);
      toolUsed = "tsc";
    }
  }

  if (toolUsed) {
    const content = existsSync(saFile) ? readFileSync(saFile, "utf-8").trim() : "";
    if (content) {
      console.log(`    ${toolUsed}: ${content.split("\n").length} diagnostic lines`);
    } else {
      writeFileSync(saFile, `# No issues found in changed files (${toolUsed})\n`);
      console.log(`    ${toolUsed}: clean`);
    }
  } else {
    writeFileSync(saFile, "# No static analysis tool available (install oxlint, biome, or ensure tsconfig.json exists)\n");
    console.log("    (no linter available, skipped — install oxlint for fast analysis)");
  }
}
