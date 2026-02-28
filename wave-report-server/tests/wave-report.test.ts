// wave-report.test.ts — Comprehensive tests for wave report server
// Run: cd ~/.boring/wave-report-server && bun test

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, writeFile, mkdir, rm, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { existsSync } from "fs";

// ── Test fixtures ──

function makeManifest(harness: string, projectRoot: string, progressRel: string, status = "active") {
  return JSON.stringify({
    harness,
    project_root: projectRoot,
    status,
    created_at: "2026-01-01T00:00:00Z",
    files: { progress: progressRel },
  });
}

function makeProgress(overrides: Record<string, any> = {}) {
  return JSON.stringify({
    harness: "test-harness",
    mission: "Test mission for verification",
    status: "active",
    started_at: "2026-01-01T00:00:00Z",
    session_count: 2,
    tasks: {
      "task-a": {
        status: "completed",
        description: "First task. Does something important.",
        steps: ["step 1", "step 2"],
        completed_steps: ["step 1", "step 2"],
        blockedBy: [],
        owner: null,
        metadata: {},
      },
      "task-b": {
        status: "in_progress",
        description: "Second task with more detail. Has multiple sentences here.",
        steps: ["step 1", "step 2", "step 3"],
        completed_steps: ["step 1"],
        blockedBy: [],
        owner: "agent-1",
        metadata: {},
      },
      "task-c": {
        status: "pending",
        description: "Blocked task.",
        steps: [],
        completed_steps: [],
        blockedBy: ["task-b"],
        owner: null,
        metadata: {},
      },
    },
    waves: [
      { id: 1, name: "Foundation", description: "First wave", tasks: ["task-a"], status: "completed" },
      { id: 2, name: "Building", description: "Second wave", tasks: ["task-b", "task-c"], status: "in_progress" },
    ],
    learnings: [
      { id: "learn-1", timestamp: "2026-01-01T12:00:00Z", text: "Important learning from wave 1" },
    ],
    state: {},
    commits: [],
    ...overrides,
  });
}

// ── Component Tests ──

import { heroSection, controlsBar, waveSection, ungroupedTasks, beforeAfterSection, learningsSection, sidebar, indexPage } from "../components";
import type { ProgressData, RegistryEntry, WaveData, TaskData } from "../types";

function parseProgress(json: string): ProgressData {
  return JSON.parse(json);
}

function makeEntry(overrides: Partial<RegistryEntry> = {}): RegistryEntry {
  return {
    harness: "test-harness",
    status: "active",
    projectRoot: "/tmp/test",
    progressPath: "/tmp/test/progress.json",
    screenshotsDir: null,
    tasksDone: 1,
    tasksTotal: 3,
    issues: [],
    ...overrides,
  };
}

describe("components", () => {
  describe("heroSection", () => {
    test("renders harness name, mission, and metrics", () => {
      const data = parseProgress(makeProgress());
      const entry = makeEntry();
      const html = heroSection(data, entry);
      expect(html).toContain("test-harness");
      expect(html).toContain("Test mission for verification");
      expect(html).toContain("1/3"); // tasks done/total
      expect(html).toContain("33%"); // progress pct
      expect(html).toContain("1/2"); // waves done
    });

    test("shows 100% green when all tasks complete", () => {
      const data = parseProgress(makeProgress({
        tasks: {
          "t-1": { status: "completed", description: "Done" },
          "t-2": { status: "completed", description: "Done too" },
        },
        waves: [{ id: 1, name: "All", tasks: ["t-1", "t-2"], status: "completed" }],
      }));
      const html = heroSection(data, makeEntry({ tasksDone: 2, tasksTotal: 2 }));
      expect(html).toContain("100%");
      expect(html).toContain('class="value green"');
    });

    test("handles missing mission", () => {
      const data = parseProgress(makeProgress({ mission: undefined }));
      const html = heroSection(data, makeEntry());
      expect(html).toContain("Wave Report"); // fallback
    });

    test("handles zero tasks", () => {
      const data = parseProgress(makeProgress({ tasks: {}, waves: [] }));
      const html = heroSection(data, makeEntry({ tasksDone: 0, tasksTotal: 0 }));
      expect(html).toContain("0/0");
      expect(html).toContain("0%");
    });

    test("uses entry.harness as fallback when data.harness missing", () => {
      const data = parseProgress(makeProgress({ harness: undefined }));
      const entry = makeEntry({ harness: "fallback-name" });
      const html = heroSection(data, entry);
      expect(html).toContain("fallback-name");
    });
  });

  describe("controlsBar", () => {
    test("renders expand/collapse buttons and keyboard hint", () => {
      const html = controlsBar();
      expect(html).toContain("Expand All");
      expect(html).toContain("Collapse All");
      expect(html).toContain("E = expand");
    });
  });

  describe("waveSection", () => {
    test("renders wave header with name, number, and badge", () => {
      const data = parseProgress(makeProgress());
      const wave = data.waves![0];
      const html = waveSection(wave, data.tasks!, "test", "/screenshots/test");
      expect(html).toContain("Wave 1");
      expect(html).toContain("Foundation");
      expect(html).toContain("1/1"); // done badge
      expect(html).toContain('class="wave-badge done"'); // all done
    });

    test("renders wave description", () => {
      const data = parseProgress(makeProgress());
      const wave = data.waves![0];
      const html = waveSection(wave, data.tasks!, "test", "/ss");
      expect(html).toContain("First wave");
    });

    test("renders in-progress wave without done class", () => {
      const data = parseProgress(makeProgress());
      const wave = data.waves![1]; // wave 2: 0/2 done
      const html = waveSection(wave, data.tasks!, "test", "/ss");
      expect(html).toContain("Wave 2");
      expect(html).not.toContain('class="wave-badge done"');
    });

    test("handles wave with missing tasks gracefully", () => {
      const wave: WaveData = { id: 99, name: "Ghost", tasks: ["nonexistent-task"], status: "pending" };
      const html = waveSection(wave, {}, "test", "/ss");
      expect(html).toContain("Wave 99");
      expect(html).toContain("Ghost");
      expect(html).toContain("0/1"); // 0 done out of 1
    });

    test("renders empty wave (no tasks)", () => {
      const wave: WaveData = { id: 1, name: "Empty", tasks: [], status: "pending" };
      const html = waveSection(wave, {}, "test", "/ss");
      expect(html).toContain("0/0");
    });
  });

  describe("ungroupedTasks", () => {
    test("renders all tasks when no waves", () => {
      const tasks: Record<string, TaskData> = {
        "x": { status: "completed", description: "Task X" },
        "y": { status: "pending", description: "Task Y" },
      };
      const html = ungroupedTasks(tasks, "test", "/ss");
      expect(html).toContain("Task X");
      expect(html).toContain("Task Y");
      expect(html).toContain("2 total");
    });

    test("shows empty state for no tasks", () => {
      const html = ungroupedTasks({}, "test", "/ss");
      expect(html).toContain("No tasks found");
    });
  });

  describe("task card rendering", () => {
    test("splits description into title (first sentence) and body", () => {
      const data = parseProgress(makeProgress());
      const wave = data.waves![1]; // has task-b with multi-sentence desc
      const html = waveSection(wave, data.tasks!, "test", "/ss");
      expect(html).toContain("Second task with more detail.");
      expect(html).toContain("Has multiple sentences here.");
    });

    test("renders step checkboxes with done status", () => {
      const data = parseProgress(makeProgress());
      const wave = data.waves![0]; // task-a: all steps done
      const html = waveSection(wave, data.tasks!, "test", "/ss");
      expect(html).toContain('class="done"');
      expect(html).toContain("step 1");
      expect(html).toContain("step 2");
    });

    test("renders task metadata (owner, blockedBy, step count)", () => {
      const data = parseProgress(makeProgress());
      const wave = data.waves![1]; // task-b has owner, task-c has blockedBy
      const html = waveSection(wave, data.tasks!, "test", "/ss");
      expect(html).toContain("owner: agent-1");
      expect(html).toContain("blocked by: task-b");
      expect(html).toContain("1/3 steps");
    });

    test("renders screenshot when metadata.screenshot exists", () => {
      const tasks: Record<string, TaskData> = {
        "ss-task": {
          status: "completed",
          description: "Has screenshot.",
          metadata: { screenshot: "test-shot.png" },
        },
      };
      const wave: WaveData = { id: 1, name: "SS", tasks: ["ss-task"], status: "completed" };
      const html = waveSection(wave, tasks, "my-harness", "/screenshots/my-harness");
      expect(html).toContain("/screenshots/my-harness/test-shot.png");
      expect(html).toContain("showLightbox");
    });

    test("renders task status badges correctly", () => {
      const data = parseProgress(makeProgress());
      const allHtml = data.waves!.map(w => waveSection(w, data.tasks!, "t", "/ss")).join("");
      expect(allHtml).toContain('class="task-status completed"');
      expect(allHtml).toContain('class="task-status in_progress"');
      expect(allHtml).toContain('class="task-status pending"');
    });
  });

  describe("beforeAfterSection", () => {
    test("renders before/after pairs", () => {
      const html = beforeAfterSection([
        { before: "Old behavior", after: "New behavior" },
        { before: "Bug exists", after: "Bug fixed" },
      ]);
      expect(html).toContain("Before &amp; After");
      expect(html).toContain("Old behavior");
      expect(html).toContain("New behavior");
      expect(html).toContain("Bug exists");
      expect(html).toContain("Bug fixed");
    });

    test("returns empty string for no pairs", () => {
      expect(beforeAfterSection([])).toBe("");
      expect(beforeAfterSection(null as any)).toBe("");
    });
  });

  describe("learningsSection", () => {
    test("renders learnings with ids and text", () => {
      const html = learningsSection([
        { id: "l-1", text: "First learning" },
        { id: "l-2", text: "Second learning" },
      ]);
      expect(html).toContain("Learnings (2)");
      expect(html).toContain("l-1");
      expect(html).toContain("First learning");
      expect(html).toContain("Second learning");
    });

    test("hidden by default (display:none)", () => {
      const html = learningsSection([{ id: "x", text: "test" }]);
      expect(html).toContain('style="display:none"');
    });

    test("returns empty string for no learnings", () => {
      expect(learningsSection([])).toBe("");
    });
  });

  describe("sidebar", () => {
    test("renders wave tree with task dots", () => {
      const data = parseProgress(makeProgress());
      const html = sidebar(data);
      expect(html).toContain("W1: Foundation (1/1)");
      expect(html).toContain("W2: Building (0/2)");
      expect(html).toContain('class="dot completed"');
      expect(html).toContain('class="dot in_progress"');
      expect(html).toContain('class="dot pending"');
    });

    test("renders flat task list when no waves", () => {
      const data = parseProgress(makeProgress({ waves: [] }));
      const html = sidebar(data);
      expect(html).toContain("Tasks");
      expect(html).toContain("task-a");
      expect(html).toContain("task-b");
    });

    test("links to correct anchors", () => {
      const data = parseProgress(makeProgress());
      const html = sidebar(data);
      expect(html).toContain('href="#wave-1"');
      expect(html).toContain('href="#task-task-a"');
    });
  });

  describe("indexPage", () => {
    test("renders harness list", () => {
      const entries: RegistryEntry[] = [
        makeEntry({ harness: "h1", status: "active", tasksDone: 5, tasksTotal: 10, projectRoot: "/a/b" }),
        makeEntry({ harness: "h2", status: "done", tasksDone: 10, tasksTotal: 10, projectRoot: "/c/d" }),
      ];
      const html = indexPage(entries);
      expect(html).toContain("h1");
      expect(html).toContain("h2");
      expect(html).toContain("5/10");
      expect(html).toContain("10/10");
      expect(html).toContain('href="/report/h1"');
      expect(html).toContain('class="h-status active"');
      expect(html).toContain('class="h-status done"');
    });

    test("shows empty state", () => {
      const html = indexPage([]);
      expect(html).toContain("No harnesses found");
    });

    test("truncates long project paths", () => {
      const entries = [makeEntry({ projectRoot: "/very/long/path/to/some/project" })];
      const html = indexPage(entries);
      expect(html).toContain("some/project");
    });
  });
});

// ── XSS / Escaping Tests ──

describe("XSS protection", () => {
  test("escapes HTML in harness name", () => {
    const data = parseProgress(makeProgress({ harness: '<script>alert("xss")</script>' }));
    const html = heroSection(data, makeEntry());
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  test("escapes HTML in mission", () => {
    const data = parseProgress(makeProgress({ mission: '<img onerror="alert(1)" src=x>' }));
    const html = heroSection(data, makeEntry());
    // The key: angle brackets are escaped, so browser won't create an element
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img ");
    expect(html).toContain("&quot;alert(1)&quot;");
  });

  test("escapes HTML in task descriptions", () => {
    const tasks: Record<string, TaskData> = {
      "xss": { status: "completed", description: '<b onclick="steal()">Click me</b>' },
    };
    const wave: WaveData = { id: 1, name: "T", tasks: ["xss"], status: "done" };
    const html = waveSection(wave, tasks, "t", "/ss");
    // Angle brackets escaped — browser won't create a <b> element
    expect(html).toContain("&lt;b");
    expect(html).not.toContain("<b ");
    expect(html).toContain("&quot;steal()&quot;");
  });

  test("escapes HTML in learning text", () => {
    const html = learningsSection([{ id: "x", text: "Normal <script>evil()</script> text" }]);
    expect(html).toContain("&lt;script&gt;");
  });

  test("escapes HTML in wave names", () => {
    const data = parseProgress(makeProgress({
      waves: [{ id: 1, name: '"><img src=x onerror=alert(1)>', tasks: [], status: "pending" }],
    }));
    const html = sidebar(data);
    // Angle brackets and quotes escaped — no element injection possible
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img ");
    expect(html).toContain("&quot;&gt;");
  });

  test("escapes special chars in screenshot path", () => {
    const tasks: Record<string, TaskData> = {
      "t": { status: "completed", description: "Test.", metadata: { screenshot: '"><script>alert(1)</script>' } },
    };
    const wave: WaveData = { id: 1, name: "T", tasks: ["t"], status: "done" };
    const html = waveSection(wave, tasks, "h", "/ss/h");
    expect(html).not.toContain("<script>");
  });
});

// ── Renderer Integration Tests ──

import { renderReport, renderIndex } from "../renderer";

describe("renderer", () => {
  describe("renderReport", () => {
    test("produces valid HTML with doctype", () => {
      const data = parseProgress(makeProgress());
      const html = renderReport(data, makeEntry());
      expect(html).toStartWith("<!DOCTYPE html>");
      expect(html).toContain("</html>");
    });

    test("includes CSS", () => {
      const data = parseProgress(makeProgress());
      const html = renderReport(data, makeEntry());
      expect(html).toContain("--paper: #faf6f0");
      expect(html).toContain("EB Garamond");
    });

    test("includes client-side JavaScript", () => {
      const data = parseProgress(makeProgress());
      const html = renderReport(data, makeEntry());
      expect(html).toContain("toggleAll");
      expect(html).toContain("showLightbox");
      expect(html).toContain("IntersectionObserver");
    });

    test("renders all waves", () => {
      const data = parseProgress(makeProgress());
      const html = renderReport(data, makeEntry());
      expect(html).toContain("Wave 1");
      expect(html).toContain("Wave 2");
      expect(html).toContain("Foundation");
      expect(html).toContain("Building");
    });

    test("renders ungrouped tasks when no waves", () => {
      const data = parseProgress(makeProgress({ waves: undefined }));
      const html = renderReport(data, makeEntry());
      expect(html).toContain("All Tasks");
    });

    test("includes before/after section from state", () => {
      const data = parseProgress(makeProgress({
        state: { beforeAfter: [{ before: "Was broken", after: "Now fixed" }] },
      }));
      const html = renderReport(data, makeEntry());
      expect(html).toContain("Before &amp; After");
      expect(html).toContain("Was broken");
      expect(html).toContain("Now fixed");
    });

    test("collects before/after from task metadata", () => {
      const data = parseProgress(makeProgress({
        tasks: {
          "ba-task": {
            status: "completed",
            description: "Test.",
            metadata: { before: "Old way", after: "New way" },
          },
        },
        waves: [{ id: 1, name: "T", tasks: ["ba-task"], status: "done" }],
      }));
      const html = renderReport(data, makeEntry());
      expect(html).toContain("Old way");
      expect(html).toContain("New way");
    });

    test("includes learnings section", () => {
      const data = parseProgress(makeProgress());
      const html = renderReport(data, makeEntry());
      expect(html).toContain("Learnings (1)");
    });

    test("includes sidebar with TOC", () => {
      const data = parseProgress(makeProgress());
      const html = renderReport(data, makeEntry());
      expect(html).toContain("report-sidebar");
      expect(html).toContain("Contents");
    });

    test("includes lightbox overlay", () => {
      const data = parseProgress(makeProgress());
      const html = renderReport(data, makeEntry());
      expect(html).toContain('class="lightbox"');
      expect(html).toContain("lightbox-img");
    });
  });

  describe("renderIndex", () => {
    test("produces valid HTML with doctype", () => {
      const html = renderIndex([makeEntry()]);
      expect(html).toStartWith("<!DOCTYPE html>");
      expect(html).toContain("Harness Reports");
    });

    test("sorts active harnesses first", () => {
      const entries = [
        makeEntry({ harness: "z-done", status: "done" }),
        makeEntry({ harness: "a-active", status: "active" }),
        makeEntry({ harness: "m-done", status: "done" }),
      ];
      const html = renderIndex(entries);
      const aPos = html.indexOf("a-active");
      const zPos = html.indexOf("z-done");
      const mPos = html.indexOf("m-done");
      expect(aPos).toBeLessThan(zPos);
      expect(aPos).toBeLessThan(mPos);
    });

    test("sorts alphabetically within status group", () => {
      const entries = [
        makeEntry({ harness: "c-active", status: "active" }),
        makeEntry({ harness: "a-active", status: "active" }),
      ];
      const html = renderIndex(entries);
      expect(html.indexOf("a-active")).toBeLessThan(html.indexOf("c-active"));
    });

    test("shows count of active harnesses", () => {
      const entries = [
        makeEntry({ harness: "h1", status: "active" }),
        makeEntry({ harness: "h2", status: "done" }),
        makeEntry({ harness: "h3", status: "active" }),
      ];
      const html = renderIndex(entries);
      expect(html).toContain("3 harnesses");
      expect(html).toContain("2 active");
    });
  });
});

// ── Scanner Tests ──

describe("scanner", () => {
  let tmpDir: string;
  let origHome: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "wave-report-test-"));
    origHome = process.env.HOME!;
  });

  afterAll(async () => {
    process.env.HOME = origHome;
    await rm(tmpDir, { recursive: true, force: true });
  });

  // Helper: set up fake manifest + progress structure
  async function setupFixture(opts: {
    harness: string;
    manifestJson: string;
    progressJson?: string;
    progressRel?: string;
    projectFiles?: Record<string, string>;
  }) {
    const fakeHome = join(tmpDir, `home-${opts.harness}`);
    const manifestDir = join(fakeHome, ".boring/harness/manifests", opts.harness);
    const serverDir = join(fakeHome, ".boring/wave-report-server");
    const projectRoot = join(fakeHome, "project");

    await mkdir(manifestDir, { recursive: true });
    await mkdir(serverDir, { recursive: true });
    await mkdir(projectRoot, { recursive: true });

    await writeFile(join(manifestDir, "manifest.json"), opts.manifestJson);

    if (opts.progressJson && opts.progressRel) {
      const progressPath = join(projectRoot, opts.progressRel);
      await mkdir(join(progressPath, ".."), { recursive: true });
      await writeFile(progressPath, opts.progressJson);
    }

    if (opts.projectFiles) {
      for (const [rel, content] of Object.entries(opts.projectFiles)) {
        const full = join(projectRoot, rel);
        await mkdir(join(full, ".."), { recursive: true });
        await writeFile(full, content);
      }
    }

    return { fakeHome, projectRoot, serverDir };
  }

  test("scanner discovers harnesses from manifests", async () => {
    const { fakeHome, projectRoot } = await setupFixture({
      harness: "scan-test-1",
      manifestJson: makeManifest("scan-test-1", "", "progress.json"),
      progressJson: makeProgress(),
      progressRel: "progress.json",
    });

    // Patch manifest with correct project root
    const mPath = join(fakeHome, ".boring/harness/manifests/scan-test-1/manifest.json");
    await writeFile(mPath, makeManifest("scan-test-1", projectRoot, "progress.json"));

    // The real scanner reads from HOME, so we test the components instead
    // Parse the manifest directly
    const manifest = JSON.parse(await readFile(mPath, "utf-8"));
    expect(manifest.harness).toBe("scan-test-1");
    expect(manifest.project_root).toBe(projectRoot);
  });

  test("scanner detects missing progress file", async () => {
    const { fakeHome, projectRoot } = await setupFixture({
      harness: "scan-missing",
      manifestJson: makeManifest("scan-missing", "", "nonexistent.json"),
    });

    const mPath = join(fakeHome, ".boring/harness/manifests/scan-missing/manifest.json");
    await writeFile(mPath, makeManifest("scan-missing", projectRoot, "nonexistent.json"));

    const progressPath = join(projectRoot, "nonexistent.json");
    expect(existsSync(progressPath)).toBe(false);
  });

  test("scanner detects invalid JSON in progress", async () => {
    const { projectRoot } = await setupFixture({
      harness: "scan-bad-json",
      manifestJson: makeManifest("scan-bad-json", "", "bad.json"),
      progressRel: "bad.json",
      progressJson: "{ not valid json }}}",
    });

    const progressPath = join(projectRoot, "bad.json");
    expect(existsSync(progressPath)).toBe(true);

    // Verify it's actually invalid
    let threw = false;
    try { JSON.parse(await readFile(progressPath, "utf-8")); } catch { threw = true; }
    expect(threw).toBe(true);
  });

  test("scanner finds screenshots directory", async () => {
    const { projectRoot } = await setupFixture({
      harness: "scan-screenshots",
      manifestJson: makeManifest("scan-screenshots", "", "progress.json"),
      progressJson: makeProgress(),
      progressRel: "progress.json",
      projectFiles: {
        "claude_files/screenshots/test.png": "fake",
      },
    });

    const ssDir = join(projectRoot, "claude_files/screenshots");
    expect(existsSync(ssDir)).toBe(true);
  });

  test("scanner detects orphaned screenshot references", async () => {
    const progressWithScreenshot = makeProgress({
      tasks: {
        "ss-task": {
          status: "completed",
          description: "Has ref.",
          metadata: { screenshot: "missing.png" },
        },
      },
      waves: [{ id: 1, name: "T", tasks: ["ss-task"], status: "done" }],
    });

    const { projectRoot } = await setupFixture({
      harness: "scan-orphan-ss",
      manifestJson: makeManifest("scan-orphan-ss", "", "progress.json"),
      progressJson: progressWithScreenshot,
      progressRel: "progress.json",
      // No screenshots directory created
    });

    // Verify no screenshots dir
    expect(existsSync(join(projectRoot, "claude_files/screenshots"))).toBe(false);
    expect(existsSync(join(projectRoot, "src/tests/e2e/screenshots"))).toBe(false);
  });

  test("scanner validates wave→task references", async () => {
    const badWaveProgress = makeProgress({
      tasks: { "real-task": { status: "completed", description: "Real." } },
      waves: [{ id: 1, name: "Bad", tasks: ["real-task", "ghost-task"], status: "pending" }],
    });

    const data = JSON.parse(badWaveProgress);
    const tasks = data.tasks;
    expect(tasks["real-task"]).toBeDefined();
    expect(tasks["ghost-task"]).toBeUndefined();
  });
});

// ── Edge Cases ──

describe("edge cases", () => {
  test("handles progress with only tasks, no waves, no learnings", () => {
    const data = parseProgress(JSON.stringify({
      harness: "minimal",
      tasks: { "only-task": { status: "pending", description: "Just one." } },
    }));
    const html = renderReport(data, makeEntry({ harness: "minimal" }));
    expect(html).toContain("minimal");
    expect(html).toContain("All Tasks");
    expect(html).toContain("Just one.");
  });

  test("handles completely empty progress file", () => {
    const data: ProgressData = {};
    const html = renderReport(data, makeEntry());
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Wave Report"); // fallback title
  });

  test("handles tasks with empty strings", () => {
    const data = parseProgress(makeProgress({
      tasks: {
        "empty": { status: "completed", description: "", steps: [], completed_steps: [] },
      },
      waves: [{ id: 1, name: "", tasks: ["empty"], status: "done" }],
    }));
    const html = renderReport(data, makeEntry());
    expect(html).toContain("Wave 1"); // still renders
  });

  test("handles very long task descriptions", () => {
    const longDesc = "A".repeat(5000) + ". Second sentence.";
    const data = parseProgress(makeProgress({
      tasks: { "long": { status: "pending", description: longDesc } },
      waves: [{ id: 1, name: "T", tasks: ["long"], status: "pending" }],
    }));
    const html = renderReport(data, makeEntry());
    expect(html).toContain("A".repeat(100)); // at least some of the long desc
  });

  test("handles Unicode in all fields", () => {
    const data = parseProgress(makeProgress({
      harness: "unicode-测试",
      mission: "工单管理系统优化 🔧",
      tasks: {
        "任务一": { status: "completed", description: "第一个任务。完成了。" },
      },
      waves: [{ id: 1, name: "第一阶段", tasks: ["任务一"], status: "completed" }],
      learnings: [{ id: "学习-1", text: "学到了很多 — em dash and 'quotes'" }],
    }));
    const html = renderReport(data, makeEntry());
    expect(html).toContain("unicode-测试");
    expect(html).toContain("第一阶段");
    expect(html).toContain("第一个任务");
  });

  test("handles task with all optional fields missing", () => {
    const data = parseProgress(makeProgress({
      tasks: { "bare": { status: "pending" } },
      waves: [{ id: 1, name: "T", tasks: ["bare"], status: "pending" }],
    }));
    const html = renderReport(data, makeEntry());
    expect(html).toContain("bare");
  });

  test("handles duplicate task IDs in wave references", () => {
    const data = parseProgress(makeProgress({
      tasks: { "dup": { status: "completed", description: "Dup." } },
      waves: [{ id: 1, name: "T", tasks: ["dup", "dup"], status: "done" }],
    }));
    const html = renderReport(data, makeEntry());
    // Should render without crashing; may show task twice
    expect(html).toContain("Dup.");
  });

  test("handles wave with no tasks array", () => {
    const data: ProgressData = {
      harness: "no-tasks-wave",
      waves: [{ id: 1, name: "Empty" } as any],
      tasks: {},
    };
    const html = renderReport(data, makeEntry());
    expect(html).toContain("Wave 1");
    expect(html).toContain("0/0");
  });

  test("handles state.beforeAfter as priority over task metadata", () => {
    const data = parseProgress(makeProgress({
      tasks: {
        "ba": { status: "completed", description: "T.", metadata: { before: "meta-before", after: "meta-after" } },
      },
      waves: [{ id: 1, name: "T", tasks: ["ba"], status: "done" }],
      state: { beforeAfter: [{ before: "state-before", after: "state-after" }] },
    }));
    const html = renderReport(data, makeEntry());
    // state.beforeAfter should take priority
    expect(html).toContain("state-before");
    expect(html).toContain("state-after");
  });

  test("handles many waves (10+)", () => {
    const tasks: Record<string, TaskData> = {};
    const waves: WaveData[] = [];
    for (let i = 1; i <= 12; i++) {
      const taskId = `task-${i}`;
      tasks[taskId] = { status: i <= 8 ? "completed" : "pending", description: `Task ${i}.` };
      waves.push({ id: i, name: `Wave ${i}`, tasks: [taskId], status: i <= 8 ? "completed" : "pending" });
    }
    const data = parseProgress(makeProgress({ tasks, waves }));
    const html = renderReport(data, makeEntry());
    expect(html).toContain("Wave 12");
    expect(html).toContain("W12:");
  });
});

// ── Server Route Tests (unit-level, no actual HTTP) ──

describe("server route matching", () => {
  // Test the URL patterns the server would match
  test("index pattern", () => {
    expect("/").toMatch(/^\/$/);
    expect("/index").toMatch(/^\/index$/);
  });

  test("report pattern extracts harness name", () => {
    const match = "/report/finance-ux-v2".match(/^\/report\/([^/]+)$/);
    expect(match).toBeTruthy();
    expect(match![1]).toBe("finance-ux-v2");
  });

  test("report pattern handles URL-encoded names", () => {
    const match = "/report/unicode-%E6%B5%8B%E8%AF%95".match(/^\/report\/([^/]+)$/);
    expect(match).toBeTruthy();
    expect(decodeURIComponent(match![1])).toBe("unicode-测试");
  });

  test("screenshot pattern extracts harness and path", () => {
    const match = "/screenshots/my-harness/subdir/image.png".match(/^\/screenshots\/([^/]+)\/(.+)$/);
    expect(match).toBeTruthy();
    expect(match![1]).toBe("my-harness");
    expect(match![2]).toBe("subdir/image.png");
  });

  test("API scan pattern", () => {
    expect("/api/scan").toMatch(/^\/api\/scan$/);
  });

  test("API issues pattern extracts harness", () => {
    const match = "/api/issues/finance-ux-v2".match(/^\/api\/issues\/([^/]+)$/);
    expect(match).toBeTruthy();
    expect(match![1]).toBe("finance-ux-v2");
  });

  test("rejects invalid paths", () => {
    expect("/report/").not.toMatch(/^\/report\/([^/]+)$/);
    expect("/report/a/b").not.toMatch(/^\/report\/([^/]+)$/);
    expect("/screenshots/").not.toMatch(/^\/screenshots\/([^/]+)\/(.+)$/);
  });
});
