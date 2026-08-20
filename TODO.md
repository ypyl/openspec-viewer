# TODO

## ~Highlight & comment on artifacts → LLM fix prompt~ ✅ shipped in v1.5.0

- ~~Allow selecting/highlighting text in an artifact (spec, ADR, task, change).~~
- ~~Add inline comments on highlighted ranges.~~
- ~~Collect highlights + comments + artifact content into a single final prompt for an LLM to fix them.~~
- ~~Need a "copy prompt" / "send to LLM" action.~~

## Comments popup positioning at bottom of screen

- The comments popup does not display well when the highlighted range / comment anchor is near the bottom of the screen: it overflows the viewport instead of flipping or repositioning above the anchor.
- Fix: detect available space below the anchor and open the popup upward (or clamp within the viewport) when there is not enough room below.

## Whole-file review comments

- Support adding a review comment that targets the entire artifact (proposal, design, task, change, ADR) rather than only a highlighted text range.
- For feedback that applies to the whole document, e.g. formatting, general language, tone, structure.
- Whole-file comments show up in the review panel alongside range-based highlights and are folded into the generated LLM prompt.
- Provide a discoverable affordance (e.g. comment button on the artifact header) so it is not hidden behind text selection.

## Validate artifacts against the OpenSpec spec

- Basic validation of openspec/ structure and artifacts against the OpenSpec documentation: required files (spec.md, proposal.md, task.md, change.md, ADRs), required sections, frontmatter/header conventions.
- Show validation issues in the UI (warnings/errors per artifact).

## ~Highlight exactly what changed in a proposal~ ✅ shipped in v1.10.0

- ~~Current change detection is file-level only (lastModified snapshot → "new" marker).~~
- ~~Feasible: snapshot each artifact's raw content in IndexedDB per scan, line-diff old vs new, render the diff (unified view or highlighted lines in the pane).~~
- ~~The File System Access API exposes no previous versions, so content must be snapshotted ourselves.~~

## ~Mark diff (changes) as read~ ✅ shipped in v2.2.0

- ~~Allow marking a file's changes as read; a file is marked automatically as soon as its diff view is opened.~~
- ~~Persist read state so it survives reloads (IndexedDB), and reflect it in the file list (e.g. dim/clear the "new" marker, no longer count it in group counters).~~

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

## Review: generate two types of prompts

- Extend the review panel to offer two prompt modes from the collected highlights + comments + artifact content:
  - **fix/modify** — the current behavior: prompt the LLM to apply the requested changes. Not only corrections: if the highlighted artifact has an open-question section (e.g. design open questions), the prompt also asks the model to answer those.
  - **explain** — new: user asks the model to explain what was highlighted because it is not clear to them; the prompt asks for an explanation instead of edits.
- Add a mode selector in the review panel; the copy-prompt / send-to-LLM action uses the selected mode.

## Collect review history per project

- Persist completed reviews (highlights, comments, chosen prompt mode, sent prompt) per project folder, e.g. in IndexedDB keyed by project.
- Treat them as a history of corrections to enable insight extraction over time: recurring issues, which sections/artifacts get most feedback, process health.
- Keep an eye on storage growth: prune/export/clear old history.

## ~Fuzzy search within all documents' content~ ✅ shipped in v2.3.0

- ~~Add a fuzzy search that matches against the content of all documents (specs, ADRs, tasks, changes), not just filenames/headings.~~
- ~~Search across the whole openspec tree, index artifacts by content in IndexedDB to keep searches fast.~~
- ~~Show results with snippet/matches and link to the containing artifact; highlight matching lines when the artifact is opened.~~
- ~~Use **Fuse.js v7** (vendored as lib/fuse.min.js, UMD loaded off window, re-exported via imports.js — same pattern as marked/js-yaml). Full build with bitap for real fuzzy matching; at ~24KB minified. Load matches index order on file list, reuse its highlight/matches info for snippets.~~
