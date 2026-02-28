// components.ts — HTML component builders for wave reports
// Pure functions: data → HTML string. No side effects.

import type { ProgressData, TaskData, WaveData, Learning, BeforeAfter, RegistryEntry } from "./types";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Hero ──
export function heroSection(data: ProgressData, entry: RegistryEntry): string {
  const tasks = Object.values(data.tasks ?? {});
  const done = tasks.filter(t => t.status === "completed").length;
  const inProg = tasks.filter(t => t.status === "in_progress").length;
  const total = tasks.length;
  const waves = data.waves?.length ?? 0;
  const wavesDone = (data.waves ?? []).filter(w => w.status === "completed").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const sessions = data.session_count ?? data.current_session?.round_count ?? "—";

  return `
  <div class="hero" id="top">
    <div class="hero-label">${esc(data.harness ?? entry.harness)}</div>
    <div class="hero-title">${esc(data.mission ?? "Wave Report")}</div>
    <div class="hero-metrics">
      <div class="hero-metric"><span class="label">Tasks</span><span class="value">${done}/${total}</span></div>
      <div class="hero-metric"><span class="label">Progress</span><span class="value ${pct === 100 ? "green" : "orange"}">${pct}%</span></div>
      <div class="hero-metric"><span class="label">Waves</span><span class="value">${wavesDone}/${waves}</span></div>
      <div class="hero-metric"><span class="label">In Progress</span><span class="value orange">${inProg}</span></div>
      <div class="hero-metric"><span class="label">Sessions</span><span class="value">${sessions}</span></div>
      <div class="hero-metric"><span class="label">Status</span><span class="value">${esc(data.status ?? "unknown")}</span></div>
    </div>
  </div>`;
}

// ── Expand/Collapse Controls ──
export function controlsBar(): string {
  return `
  <div class="controls">
    <button onclick="toggleAll(true)">&#9660; Expand All</button>
    <button onclick="toggleAll(false)">&#9650; Collapse All</button>
    <span class="hint">E = expand &middot; C = collapse</span>
  </div>`;
}

// ── Wave Section ──
export function waveSection(wave: WaveData, allTasks: Record<string, TaskData>, harnessName: string, screenshotsBase: string): string {
  const waveTasks = (wave.tasks ?? []).map(id => ({ id, ...(allTasks[id] ?? { status: "pending", description: "" }) }));
  const done = waveTasks.filter(t => t.status === "completed").length;
  const total = waveTasks.length;
  const badgeClass = done === total ? "done" : "";

  const taskCards = waveTasks.map(t => taskCard(t.id, t as TaskData, harnessName, screenshotsBase)).join("\n");

  return `
  <div class="wave" id="wave-${wave.id}">
    <div class="wave-header">
      <span class="wave-num">Wave ${wave.id}</span>
      <span class="wave-name">${esc(wave.name ?? `Wave ${wave.id}`)}</span>
      <span class="wave-badge ${badgeClass}">${done}/${total}</span>
    </div>
    ${wave.description ? `<div class="wave-desc">${esc(wave.description)}</div>` : ""}
    ${taskCards}
  </div>`;
}

// ── Ungrouped Tasks (no waves defined) ──
export function ungroupedTasks(tasks: Record<string, TaskData>, harnessName: string, screenshotsBase: string): string {
  const entries = Object.entries(tasks);
  if (entries.length === 0) return `<div class="empty-state">No tasks found in progress.json</div>`;

  return `
  <div class="wave" id="wave-all">
    <div class="wave-header">
      <span class="wave-num">All Tasks</span>
      <span class="wave-name">${entries.length} total</span>
    </div>
    ${entries.map(([id, t]) => taskCard(id, t, harnessName, screenshotsBase)).join("\n")}
  </div>`;
}

// ── Task Card ──
function taskCard(id: string, task: TaskData, harnessName: string, screenshotsBase: string): string {
  const steps = task.steps ?? [];
  const completedSteps = new Set(task.completed_steps ?? []);
  const screenshotPath = task.metadata?.screenshot;
  const screenshotUrl = screenshotPath ? `${screenshotsBase}/${screenshotPath}` : null;

  // Use description as title (first sentence), rest as body
  const desc = task.description ?? "";
  const firstSentence = desc.split(/(?<=[.!?])\s/)[0] || desc;
  const restDesc = desc.slice(firstSentence.length).trim();

  const stepItems = steps.map(s => {
    const isDone = completedSteps.has(s);
    return `<li class="${isDone ? "done" : ""}">${esc(s)}</li>`;
  }).join("\n");

  const metaParts: string[] = [];
  if (steps.length > 0) metaParts.push(`${completedSteps.size}/${steps.length} steps`);
  if (task.owner) metaParts.push(`owner: ${esc(task.owner)}`);
  if (task.blockedBy?.length) metaParts.push(`blocked by: ${task.blockedBy.join(", ")}`);

  return `
  <div class="task" id="task-${esc(id)}">
    <div class="task-header" onclick="this.parentElement.classList.toggle('open')">
      <span class="task-chevron">&#9654;</span>
      <span class="task-id">${esc(id)}</span>
      <span class="task-title">${esc(firstSentence)}</span>
      <span class="task-status ${task.status ?? "pending"}">${task.status ?? "pending"}</span>
    </div>
    <div class="task-body">
      <div class="task-content">
        <div class="task-text">
          ${restDesc ? `<div class="task-desc">${esc(restDesc)}</div>` : ""}
          ${steps.length > 0 ? `<ul class="task-steps">${stepItems}</ul>` : ""}
          ${metaParts.length > 0 ? `<div class="task-meta">${metaParts.map(m => `<span>${esc(m)}</span>`).join("")}</div>` : ""}
        </div>
        ${screenshotUrl
          ? `<div class="task-screenshot"><img src="${esc(screenshotUrl)}" alt="${esc(id)}" onclick="showLightbox(this.src)" onerror="this.parentElement.innerHTML='<div class=no-img>no screenshot</div>'"></div>`
          : ""}
      </div>
    </div>
  </div>`;
}

// ── Before/After Section ──
export function beforeAfterSection(pairs: BeforeAfter[]): string {
  if (!pairs || pairs.length === 0) return "";
  const items = pairs.map(p => `
    <div class="ba-pair">
      <div class="ba-card before"><div class="ba-label">Before</div>${esc(p.before)}</div>
      <div class="ba-card after"><div class="ba-label">After</div>${esc(p.after)}</div>
    </div>
  `).join("\n");

  return `
  <div class="ba-section">
    <h3>Before &amp; After</h3>
    ${items}
  </div>`;
}

// ── Learnings Section ──
export function learningsSection(learnings: Learning[]): string {
  if (!learnings || learnings.length === 0) return "";
  const items = learnings.map(l => `
    <li>
      <span class="learning-id">${esc(l.id ?? "")}</span>
      ${esc(l.text ?? "")}
    </li>
  `).join("\n");

  return `
  <div class="learnings">
    <h3 onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
      Learnings (${learnings.length}) &#9660;
    </h3>
    <ul class="learnings-list" style="display:none">${items}</ul>
  </div>`;
}

// ── Sidebar TOC ──
export function sidebar(data: ProgressData): string {
  const waves = data.waves ?? [];
  const tasks = data.tasks ?? {};

  if (waves.length === 0) {
    // No waves — flat task list
    const taskLinks = Object.entries(tasks).map(([id, t]) =>
      `<a class="sidebar-task" href="#task-${esc(id)}" data-task="${esc(id)}"><span class="dot ${t.status}"></span>${esc(id)}</a>`
    ).join("\n");
    return `
    <div class="sidebar-title">Tasks</div>
    ${taskLinks}`;
  }

  const waveBlocks = waves.map(w => {
    const taskLinks = (w.tasks ?? []).map(id => {
      const t = tasks[id];
      const status = t?.status ?? "pending";
      return `<a class="sidebar-task" href="#task-${esc(id)}" data-task="${esc(id)}"><span class="dot ${status}"></span>${esc(id)}</a>`;
    }).join("\n");

    const done = (w.tasks ?? []).filter(id => tasks[id]?.status === "completed").length;
    return `
    <div class="sidebar-wave">
      <div class="sidebar-wave-name"><a href="#wave-${w.id}">W${w.id}: ${esc(w.name ?? "")} (${done}/${w.tasks?.length ?? 0})</a></div>
      ${taskLinks}
    </div>`;
  }).join("\n");

  return `
  <div class="sidebar-title"><a href="#top" style="color:inherit;text-decoration:none">Contents</a></div>
  ${waveBlocks}`;
}

// ── Lightbox + Scroll-Spy Script ──
export function clientScript(): string {
  return `
  <script>
    function showLightbox(src) {
      const lb = document.getElementById('lightbox');
      document.getElementById('lightbox-img').src = src;
      lb.classList.add('show');
    }
    document.getElementById('lightbox')?.addEventListener('click', function() { this.classList.remove('show'); });

    function toggleAll(open) {
      document.querySelectorAll('.task').forEach(t => {
        if (open) t.classList.add('open'); else t.classList.remove('open');
      });
    }

    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'e' || e.key === 'E') toggleAll(true);
      if (e.key === 'c' || e.key === 'C') toggleAll(false);
      if (e.key === 'Escape') document.getElementById('lightbox')?.classList.remove('show');
    });

    // Scroll-spy for sidebar
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const id = e.target.id;
          document.querySelectorAll('.sidebar-task').forEach(a => a.classList.remove('active'));
          const link = document.querySelector('.sidebar-task[data-task="' + id.replace('task-', '') + '"]');
          if (link) link.classList.add('active');
        }
      });
    }, { threshold: 0.3 });
    document.querySelectorAll('.task').forEach(t => observer.observe(t));
  </script>`;
}

// ── Index Page ──
export function indexPage(entries: RegistryEntry[]): string {
  if (entries.length === 0) {
    return `<div class="empty-state">No harnesses found. Run <code>scan.sh</code> to discover harnesses.</div>`;
  }

  const items = entries.map(e => {
    const statusClass = e.status === "done" ? "done" : "active";
    return `
    <li class="harness-item">
      <a href="/report/${esc(e.harness)}">${esc(e.harness)}</a>
      <span class="h-status ${statusClass}">${esc(e.status)}</span>
      <span class="h-progress">${e.tasksDone}/${e.tasksTotal}</span>
      <span class="h-project" title="${esc(e.projectRoot)}">${esc(e.projectRoot.split("/").slice(-2).join("/"))}</span>
    </li>`;
  }).join("\n");

  return `<ul class="harness-list">${items}</ul>`;
}
