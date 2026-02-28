// styles.ts — CSS as template literal, qbg design tokens
// Light editorial design: EB Garamond + IBM Plex Mono, warm paper palette

export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --paper: #faf6f0;
  --paper-dark: #f0ebe3;
  --ink: #3a3836;
  --ink-light: #6b6560;
  --ink-faint: #a09890;
  --orange: #e08a28;
  --orange-light: rgba(224,138,40,0.12);
  --orange-faint: rgba(224,138,40,0.06);
  --green: #3a8a5c;
  --green-light: rgba(58,138,92,0.12);
  --red: #c0392b;
  --red-light: rgba(192,57,43,0.1);
  --blue: #2d6fa5;
  --blue-light: rgba(45,111,165,0.1);
  --border: #d8d0c4;
  --border-light: #e8e2d8;
  --card-bg: #fff;
  --sidebar-bg: #f5f0e8;
  --mono: 'IBM Plex Mono', monospace;
  --serif: 'EB Garamond', Georgia, serif;
}

html { scroll-behavior: smooth; }
body { font-family: var(--serif); background: var(--paper); color: var(--ink); line-height: 1.5; font-size: 15px; }

/* ── Layout ── */
.report-wrap { display: flex; min-height: 100vh; }
.report-main { flex: 1; min-width: 0; max-width: 960px; margin: 0 auto; padding: 0 32px 80px; }
.report-sidebar { position: sticky; top: 0; height: 100vh; width: 220px; flex-shrink: 0; background: var(--sidebar-bg); border-left: 1px solid var(--border); padding: 24px 16px; overflow-y: auto; font-family: var(--mono); font-size: 11px; }

/* ── Hero ── */
.hero { padding: 40px 0 24px; border-bottom: 2px solid var(--ink); margin-bottom: 24px; }
.hero-label { font-family: var(--mono); font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 4px; }
.hero-title { font-size: 32px; font-weight: 700; line-height: 1.15; margin-bottom: 6px; }
.hero-mission { font-style: italic; color: var(--ink-light); font-size: 16px; line-height: 1.4; margin-bottom: 16px; }
.hero-metrics { display: flex; gap: 24px; flex-wrap: wrap; font-family: var(--mono); font-size: 12px; }
.hero-metric { display: flex; gap: 6px; align-items: baseline; }
.hero-metric .label { color: var(--ink-faint); text-transform: uppercase; letter-spacing: 0.5px; }
.hero-metric .value { font-weight: 600; color: var(--ink); }
.hero-metric .value.orange { color: var(--orange); }
.hero-metric .value.green { color: var(--green); }

/* ── Controls ── */
.controls { display: flex; gap: 8px; align-items: center; padding: 10px 0; margin-bottom: 16px; border-bottom: 1px solid var(--border-light); font-family: var(--mono); font-size: 11px; }
.controls button { background: none; border: 1px solid var(--border); padding: 3px 10px; cursor: pointer; font-family: var(--mono); font-size: 11px; color: var(--ink-light); transition: all 0.15s; }
.controls button:hover { border-color: var(--orange); color: var(--orange); }
.controls .hint { color: var(--ink-faint); margin-left: auto; }

/* ── Wave ── */
.wave { margin-bottom: 28px; }
.wave-header { display: flex; align-items: baseline; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); margin-bottom: 10px; }
.wave-num { font-family: var(--mono); font-size: 11px; font-weight: 600; color: var(--orange); text-transform: uppercase; letter-spacing: 1px; }
.wave-name { font-size: 20px; font-weight: 600; }
.wave-badge { font-family: var(--mono); font-size: 11px; color: var(--ink-faint); margin-left: auto; }
.wave-badge.done { color: var(--green); }
.wave-desc { font-size: 13px; color: var(--ink-light); margin-bottom: 10px; font-style: italic; }

/* ── Task Card ── */
.task { background: var(--card-bg); border: 1px solid var(--border); margin-bottom: 6px; overflow: hidden; transition: border-color 0.15s; }
.task:hover { border-color: var(--ink-faint); }
.task-header { display: flex; align-items: center; gap: 10px; padding: 8px 12px; cursor: pointer; user-select: none; }
.task-id { font-family: var(--mono); font-size: 11px; color: var(--ink-faint); min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
.task-title { font-size: 14px; font-weight: 600; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.task-status { font-family: var(--mono); font-size: 10px; font-weight: 600; padding: 2px 6px; letter-spacing: 0.5px; text-transform: uppercase; flex-shrink: 0; }
.task-status.completed { background: var(--green-light); color: var(--green); }
.task-status.in_progress { background: var(--orange-light); color: var(--orange); }
.task-status.pending { background: var(--paper-dark); color: var(--ink-faint); }
.task-chevron { color: var(--ink-faint); font-size: 12px; flex-shrink: 0; transition: transform 0.15s; width: 12px; text-align: center; }
.task.open .task-chevron { transform: rotate(90deg); }

.task-body { display: none; padding: 0 12px 10px; }
.task.open .task-body { display: block; }
.task-content { display: flex; gap: 16px; }
.task-text { flex: 1; min-width: 0; }
.task-desc { font-size: 13px; color: var(--ink-light); line-height: 1.5; margin-bottom: 8px; }
.task-steps { list-style: none; padding: 0; }
.task-steps li { font-family: var(--mono); font-size: 11px; padding: 2px 0 2px 18px; position: relative; color: var(--ink-light); }
.task-steps li::before { content: ''; position: absolute; left: 2px; top: 8px; width: 8px; height: 8px; border: 1px solid var(--border); }
.task-steps li.done { color: var(--ink); }
.task-steps li.done::before { background: var(--green); border-color: var(--green); }
.task-screenshot { width: 240px; flex-shrink: 0; }
.task-screenshot img { width: 100%; display: block; border: 1px solid var(--border); cursor: pointer; }
.task-screenshot .no-img { width: 100%; height: 140px; background: var(--paper-dark); border: 1px dashed var(--border); display: flex; align-items: center; justify-content: center; font-family: var(--mono); font-size: 10px; color: var(--ink-faint); }
.task-meta { font-family: var(--mono); font-size: 10px; color: var(--ink-faint); margin-top: 6px; display: flex; gap: 12px; }

/* ── Before/After ── */
.ba-section { margin: 28px 0; }
.ba-section h3 { font-size: 18px; font-weight: 600; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
.ba-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.ba-card { border: 1px solid var(--border); padding: 10px 12px; font-size: 13px; }
.ba-card.before { background: var(--red-light); }
.ba-card.after { background: var(--green-light); }
.ba-label { font-family: var(--mono); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
.ba-card.before .ba-label { color: var(--red); }
.ba-card.after .ba-label { color: var(--green); }

/* ── Learnings ── */
.learnings { margin: 28px 0; }
.learnings h3 { font-size: 18px; font-weight: 600; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid var(--border); cursor: pointer; }
.learnings-list { list-style: none; padding: 0; }
.learnings-list li { font-size: 13px; padding: 6px 0 6px 12px; border-left: 2px solid var(--border); margin-bottom: 4px; color: var(--ink-light); }
.learnings-list .learning-id { font-family: var(--mono); font-size: 10px; color: var(--ink-faint); }

/* ── Sidebar ── */
.sidebar-title { font-weight: 600; font-size: 12px; color: var(--ink); margin-bottom: 12px; letter-spacing: 1px; text-transform: uppercase; }
.sidebar-wave { margin-bottom: 14px; }
.sidebar-wave-name { font-weight: 600; color: var(--ink); margin-bottom: 4px; font-size: 11px; }
.sidebar-wave-name a { color: inherit; text-decoration: none; }
.sidebar-wave-name a:hover { color: var(--orange); }
.sidebar-task { display: block; padding: 2px 0; color: var(--ink-faint); text-decoration: none; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sidebar-task:hover { color: var(--orange); }
.sidebar-task.active { color: var(--orange); font-weight: 600; }
.sidebar-task .dot { display: inline-block; width: 6px; height: 6px; margin-right: 4px; vertical-align: middle; }
.sidebar-task .dot.completed { background: var(--green); }
.sidebar-task .dot.in_progress { background: var(--orange); }
.sidebar-task .dot.pending { background: var(--border); }

/* ── Lightbox ── */
.lightbox { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.88); z-index: 1000; align-items: center; justify-content: center; cursor: pointer; }
.lightbox.show { display: flex; }
.lightbox img { max-width: 94vw; max-height: 94vh; object-fit: contain; }

/* ── Index Page ── */
.index-wrap { max-width: 720px; margin: 0 auto; padding: 40px 24px; }
.index-title { font-size: 28px; font-weight: 700; margin-bottom: 6px; }
.index-sub { color: var(--ink-faint); font-family: var(--mono); font-size: 12px; margin-bottom: 24px; }
.harness-list { list-style: none; padding: 0; }
.harness-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--border); margin-bottom: 4px; background: var(--card-bg); transition: border-color 0.15s; }
.harness-item:hover { border-color: var(--orange); }
.harness-item a { font-family: var(--mono); font-size: 13px; font-weight: 600; color: var(--ink); text-decoration: none; flex: 1; }
.harness-item a:hover { color: var(--orange); }
.harness-item .h-status { font-family: var(--mono); font-size: 10px; text-transform: uppercase; padding: 2px 6px; }
.harness-item .h-status.active { background: var(--orange-light); color: var(--orange); }
.harness-item .h-status.done { background: var(--green-light); color: var(--green); }
.harness-item .h-progress { font-family: var(--mono); font-size: 11px; color: var(--ink-faint); }
.harness-item .h-project { font-family: var(--mono); font-size: 10px; color: var(--ink-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
.empty-state { padding: 40px; text-align: center; color: var(--ink-faint); font-style: italic; }

/* ── Responsive ── */
@media (max-width: 960px) {
  .report-sidebar { display: none; }
  .report-main { padding: 0 16px 60px; }
  .task-content { flex-direction: column; }
  .task-screenshot { width: 100%; }
  .ba-pair { grid-template-columns: 1fr; }
}
`;
