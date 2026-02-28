// renderer.ts — progress.json → full HTML string compiler

import { CSS } from "./styles";
import {
  heroSection,
  controlsBar,
  waveSection,
  ungroupedTasks,
  beforeAfterSection,
  learningsSection,
  sidebar,
  clientScript,
  indexPage,
} from "./components";
import type { ProgressData, RegistryEntry } from "./types";

// ── Report Page ──
export function renderReport(data: ProgressData, entry: RegistryEntry): string {
  const harnessName = data.harness ?? entry.harness;
  const screenshotsBase = `/screenshots/${encodeURIComponent(harnessName)}`;

  // Build wave sections or ungrouped tasks
  let body: string;
  if (data.waves && data.waves.length > 0) {
    body = data.waves
      .map(w => waveSection(w, data.tasks ?? {}, harnessName, screenshotsBase))
      .join("\n");
  } else {
    body = ungroupedTasks(data.tasks ?? {}, harnessName, screenshotsBase);
  }

  // Before/After pairs from state or task metadata
  const baPairs = data.state?.beforeAfter ?? collectBeforeAfter(data);

  const title = `${harnessName} — Wave Report`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="report-wrap">
  <div class="report-main">
    ${heroSection(data, entry)}
    ${controlsBar()}
    ${body}
    ${beforeAfterSection(baPairs)}
    ${learningsSection(data.learnings ?? [])}
  </div>
  <nav class="report-sidebar">
    ${sidebar(data)}
  </nav>
</div>
<div class="lightbox" id="lightbox"><img id="lightbox-img" src="" alt=""></div>
${clientScript()}
</body>
</html>`;
}

// ── Index Page ──
export function renderIndex(entries: RegistryEntry[]): string {
  // Sort: active first, then by name
  const sorted = [...entries].sort((a, b) => {
    if (a.status === "active" && b.status !== "active") return -1;
    if (a.status !== "active" && b.status === "active") return 1;
    return a.harness.localeCompare(b.harness);
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Wave Reports</title>
<style>${CSS}</style>
</head>
<body>
<div class="index-wrap">
  <div class="hero-label">WAVE REPORT SERVER</div>
  <div class="index-title">Harness Reports</div>
  <div class="index-sub">${sorted.length} harnesses &middot; ${sorted.filter(e => e.status === "active").length} active &middot; scanned just now</div>
  ${indexPage(sorted)}
</div>
</body>
</html>`;
}

// Collect before/after from task metadata
function collectBeforeAfter(data: ProgressData): { before: string; after: string }[] {
  const pairs: { before: string; after: string }[] = [];
  for (const [, task] of Object.entries(data.tasks ?? {})) {
    const meta = task.metadata;
    if (meta?.before && meta?.after) {
      pairs.push({ before: meta.before, after: meta.after });
    }
  }
  return pairs;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
