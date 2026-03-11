/**
 * Material collection: git diff generation, content file reading, auto-skip.
 */
import { existsSync, readFileSync, writeFileSync, unlinkSync, appendFileSync } from "node:fs";
import { join, basename } from "node:path";
import type { DeepReviewConfig, MaterialResult } from "./types";

const HOME = process.env.HOME || "/tmp";

/** Generate git diff based on scope type */
function generateDiff(scope: string, sessionDir: string, projectRoot: string): { lines: number; descPart: string } {
  const diffTmp = join(sessionDir, "_diff.patch");

  if (scope === "uncommitted") {
    const d1 = Bun.spawnSync(["git", "diff"], { cwd: projectRoot });
    const d2 = Bun.spawnSync(["git", "diff", "--cached"], { cwd: projectRoot });
    let content = d1.stdout.toString() + d2.stdout.toString();

    // Include untracked files
    const untracked = Bun.spawnSync(["git", "ls-files", "--others", "--exclude-standard"], { cwd: projectRoot });
    for (const f of untracked.stdout.toString().trim().split("\n").filter(Boolean)) {
      content += `diff --git a/${f} b/${f}\nnew file mode 100644\n--- /dev/null\n+++ b/${f}\n`;
      try {
        const fileContent = readFileSync(join(projectRoot, f), "utf-8");
        content += fileContent.split("\n").map((l) => `+${l}`).join("\n") + "\n";
      } catch {}
    }
    writeFileSync(diffTmp, content);
    return { lines: content.split("\n").length, descPart: "uncommitted changes" };
  }

  if (scope.startsWith("pr:")) {
    const prNum = scope.slice(3);
    const result = Bun.spawnSync(["gh", "pr", "diff", prNum], { cwd: projectRoot });
    writeFileSync(diffTmp, result.stdout.toString());
    return { lines: result.stdout.toString().split("\n").length, descPart: `PR #${prNum}` };
  }

  if (scope.includes("..")) {
    const result = Bun.spawnSync(["git", "diff", scope], { cwd: projectRoot });
    writeFileSync(diffTmp, result.stdout.toString());
    return { lines: result.stdout.toString().split("\n").length, descPart: scope };
  }

  // Check if it's a reachable commit that's an ancestor (branch base)
  const verifyResult = Bun.spawnSync(["git", "rev-parse", "--verify", `${scope}^{commit}`], { cwd: projectRoot, stderr: "pipe" });
  const scopeRev = Bun.spawnSync(["git", "rev-parse", scope], { cwd: projectRoot, stderr: "pipe" }).stdout.toString().trim();
  const mergeBase = Bun.spawnSync(["git", "merge-base", scope, "HEAD"], { cwd: projectRoot, stderr: "pipe" }).stdout.toString().trim();

  if (verifyResult.exitCode === 0 && scopeRev !== mergeBase) {
    // Branch base — try 3-dot first, fallback to 2-dot
    let result = Bun.spawnSync(["git", "diff", `${scope}...HEAD`], { cwd: projectRoot, stderr: "pipe" });
    let content = result.stdout.toString();

    if (!content.trim()) {
      result = Bun.spawnSync(["git", "diff", `${scope}..HEAD`], { cwd: projectRoot, stderr: "pipe" });
      content = result.stdout.toString();
    }

    if (!content.trim()) {
      // Check commits ahead
      const countResult = Bun.spawnSync(["git", "rev-list", `${scope}..HEAD`, "--count"], { cwd: projectRoot, stderr: "pipe" });
      const commitsAhead = parseInt(countResult.stdout.toString().trim(), 10) || 0;
      if (commitsAhead > 0) {
        console.log(`WARN: ${commitsAhead} commits ahead but tree content identical. Fallback to per-commit diffs...`);
        const revList = Bun.spawnSync(["git", "rev-list", "--reverse", `${scope}..HEAD`], { cwd: projectRoot });
        for (const sha of revList.stdout.toString().trim().split("\n").filter(Boolean)) {
          const show = Bun.spawnSync(["git", "show", sha], { cwd: projectRoot, stderr: "pipe" });
          content += show.stdout.toString();
        }
      }
    }

    writeFileSync(diffTmp, content);
    return { lines: content.split("\n").length, descPart: `changes since ${scope}` };
  }

  // Specific commit
  const showResult = Bun.spawnSync(["git", "show", scope], { cwd: projectRoot, stderr: "pipe" });
  writeFileSync(diffTmp, showResult.stdout.toString());
  return { lines: showResult.stdout.toString().split("\n").length, descPart: `commit ${scope}` };
}

/** Collect all material (additive: diff + content files) */
export function collectMaterial(config: DeepReviewConfig, sessionDir: string, projectRoot: string): MaterialResult {
  const hasDiff = !!config.scope;
  const hasContent = config.contentFiles.length > 0;
  const materialFile = join(sessionDir, "material-full.txt");
  const diffDescParts: string[] = [];
  const materialTypes: string[] = [];
  const changedFiles: string[] = [];

  // 1. Diff
  if (hasDiff) {
    console.log("Generating diff...");
    const { lines, descPart } = generateDiff(config.scope, sessionDir, projectRoot);
    const diffTmp = join(sessionDir, "_diff.patch");

    if (existsSync(diffTmp) && lines > 1) {
      const diffContent = readFileSync(diffTmp, "utf-8");
      appendFileSync(materialFile, `═══ GIT DIFF ═══\n${diffContent}\n`);
      materialTypes.push("diff");
      console.log(`  Diff: ${lines} lines`);

      // Extract changed file paths
      const pathMatches = diffContent.matchAll(/^diff --git a\/(.+?) b\//gm);
      for (const m of pathMatches) changedFiles.push(m[1]);

      unlinkSync(diffTmp);
    } else if (!hasContent) {
      throw new Error("Empty diff and no content files — nothing to review");
    } else {
      console.log("  (diff is empty, reviewing content only)");
      if (existsSync(diffTmp)) unlinkSync(diffTmp);
    }
    diffDescParts.push(descPart);
  }

  // 2. Content files
  if (hasContent) {
    console.log("Collecting content files...");
    const contentFileNames: string[] = [];
    for (let cf of config.contentFiles) {
      cf = cf.trim().replace(/^["']|["']$/g, "");
      cf = cf.replace(/^~/, HOME);
      if (!cf.startsWith("/")) cf = join(projectRoot, cf);
      if (!existsSync(cf)) {
        throw new Error(`Content file not found: ${cf}`);
      }
      console.log(`  + ${cf}`);
      appendFileSync(materialFile, `═══ FILE: ${basename(cf)} ═══\n${readFileSync(cf, "utf-8")}\n`);
      contentFileNames.push(basename(cf));
    }
    diffDescParts.push(contentFileNames.join(", "));
    materialTypes.push("content");
  }

  const diffDesc = diffDescParts.join(" + ");
  const materialContent = existsSync(materialFile) ? readFileSync(materialFile, "utf-8") : "";
  const diffLines = materialContent.split("\n").length;
  console.log(`Material: ${diffLines} lines (${diffDesc})`);

  // Detect material type
  let materialType: MaterialResult["materialType"];
  if (hasDiff && !hasContent) {
    materialType = "code_diff";
  } else if (!hasDiff && hasContent) {
    const firstFile = config.contentFiles[0]?.trim() || "";
    if (/\.(json|yaml|yml|toml|xml)$/i.test(firstFile)) {
      materialType = "config";
    } else {
      materialType = "document";
    }
  } else if (hasDiff && hasContent) {
    materialType = "mixed";
  } else {
    materialType = "code_diff";
  }
  console.log(`Material type: ${materialType}`);

  return {
    hasDiff,
    hasContent,
    materialType,
    materialFile,
    materialTypesStr: materialTypes.join("+"),
    diffDesc,
    diffLines,
    changedFiles: [...new Set(changedFiles)],
  };
}

/** Check if material should be auto-skipped */
export function shouldAutoSkip(material: MaterialResult, config: DeepReviewConfig): string | null {
  if (config.force || !material.hasDiff || material.hasContent) return null;

  const content = readFileSync(material.materialFile, "utf-8");

  // Check if ALL changed files are lockfiles
  const changedPaths = material.changedFiles;
  if (changedPaths.length > 0) {
    const lockfileNames = new Set([
      "bun.lock", "bun.lockb", "package-lock.json", "yarn.lock",
      "pnpm-lock.yaml", "Cargo.lock", "Gemfile.lock", "poetry.lock", "composer.lock",
    ]);
    const allLockfiles = changedPaths.every((p) => lockfileNames.has(basename(p)));
    if (allLockfiles) {
      return "AUTO-SKIP: All changed files are lockfiles. Use --force to override.";
    }
  }

  // Check if diff is all whitespace-only changes
  const addRemoveLines = content.match(/^\+[^+]|^-[^-]/gm) || [];
  const substantiveLines = addRemoveLines.filter((l) => !/^\+\s*$|^-\s*$/.test(l));
  if (substantiveLines.length < 5 && !config.spec) {
    return "AUTO-SKIP: <5 substantive diff lines and no --spec. Use --force to override.";
  }

  return null;
}
