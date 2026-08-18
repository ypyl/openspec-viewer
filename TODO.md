# TODO

## ~Highlight & comment on artifacts → LLM fix prompt~ ✅ shipped in v1.5.0

- ~~Allow selecting/highlighting text in an artifact (spec, ADR, task, change).~~
- ~~Add inline comments on highlighted ranges.~~
- ~~Collect highlights + comments + artifact content into a single final prompt for an LLM to fix them.~~
- ~~Need a "copy prompt" / "send to LLM" action.~~

## Validate artifacts against the OpenSpec spec

- Basic validation of openspec/ structure and artifacts against the OpenSpec documentation: required files (spec.md, proposal.md, task.md, change.md, ADRs), required sections, frontmatter/header conventions.
- Show validation issues in the UI (warnings/errors per artifact).

## ~Highlight exactly what changed in a proposal~ ✅ shipped in v1.10.0

- ~~Current change detection is file-level only (lastModified snapshot → "new" marker).~~
- ~~Feasible: snapshot each artifact's raw content in IndexedDB per scan, line-diff old vs new, render the diff (unified view or highlighted lines in the pane).~~
- ~~The File System Access API exposes no previous versions, so content must be snapshotted ourselves.~~

## ~Reduce live-monitoring poll interval 30s → 10s~ ✅ shipped in v1.4.0

- ~~Change the monitor polling interval from 30s to 10s.~~

## Monitor multiple openspec folders

- Support picking/adding several openspec folders (repos) and monitoring them at once.
- Each folder gets its own file-state snapshot, change markers, and tabs (folder switcher in the sidebar/header).
- Extends the single-folder model: state maps keyed by folder, not just rel path.

## Show which folder is opened

- Display the currently opened/monitored folder path in the UI (header or status bar).
- Persist and restore across reloads (IndexedDB already stores the last folder).

## Adopt Plain Vanilla Web techniques ✅ shipped in v1.5.1

- ~~Follow https://plainvanillaweb.com: no build tools, no frameworks, just HTML, CSS, and JS (fits the existing no-build, GitHub Pages setup).~~
- ~~Use jsebrech/html-literal for HTML generation (entity encoding by default, `htmlRaw`/`joinHtml` to opt out) — replaces the hand-rolled esc() + innerHTML string templates (list, panes, review panel, crumb, bubbles, stats).~~
- ~~Use jsebrech/tiny-signals for reactive state (`signal`/`computed`/`effect`) — theme, file/change selection, recent-changes, collapsed groups, search, highlights; file list, stats, and review panel render via computed+effect instead of manual renderList()/updateStats()/renderReviewPanel() calls.~~
- ~~Keep index.html self-contained: the three libs are inlined as a classic script (no ES module imports, so file:// still works); app stays a single file, no build step.~~
- ~~Re-evaluate CDN deps: marked (markdown), js-yaml (frontmatter), DOMPurify (sanitizing markdown output) all kept — html-literal replaced the hand-rolled encoder, not these; none has a sensible vanilla equivalent.~~
- Use jsebrech/tiny-context (web components context protocol) to pass state across component boundaries. Vendored but dormant: nothing crosses a component boundary in this single-file app. Wire it in only when UI is extracted into custom elements.
  - Alternative: split into ES modules/web components served as plain files (no build step, deployment unchanged) only if the app grows beyond one file.
