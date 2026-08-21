# TODO

## ~Highlight & comment on artifacts → LLM fix prompt~ ✅ shipped in v1.5.0

- ~~Allow selecting/highlighting text in an artifact (spec, ADR, task, change).~~
- ~~Add inline comments on highlighted ranges.~~
- ~~Collect highlights + comments + artifact content into a single final prompt for an LLM to fix them.~~
- ~~Need a "copy prompt" / "send to LLM" action.~~

## Comments popup positioning at bottom of screen ✅ shipped

- ~~The comments popup does not display well when the highlighted range / comment anchor is near the bottom of the screen: it overflows the viewport instead of flipping or repositioning above the anchor.~~
- ~~Fix: detect available space below the anchor and open the popup upward (or clamp within the viewport) when there is not enough room below.~~ (positionBubble in app/annotations.js flips above and clamps horizontally)

## ~Open the review panel as a side panel (not on top of content)~ ✅ shipped in v2.4.0

- ~~The review drawer is currently a fixed overlay (`position: fixed; top/right/bottom: 0`) that slides in and sits on top of the content pane, covering what is underneath.~~
- ~~Rebuild it as a true side panel that is part of the layout: the content pane shrinks to make room rather than being hidden behind the drawer, and the page scrolls naturally (no full-height overlay).~~
- ~~On desktop, reserve the right-hand column in-place (content reflows); on narrow/mobile widths keep an acceptable behavior (e.g. still overlay or full-width drawer) so the pane stays usable.~~

## Whole-file review comments

- Support adding a review comment that targets the entire artifact (proposal, design, task, change, ADR) rather than only a highlighted text range.
- For feedback that applies to the whole document, e.g. formatting, general language, tone, structure.
- Whole-file comments show up in the review panel alongside range-based highlights and are folded into the generated LLM prompt.
- Provide a discoverable affordance (e.g. comment button on the artifact header) so it is not hidden behind text selection.

## Validate artifacts against the OpenSpec spec

- Basic validation of openspec/ structure and artifacts against the OpenSpec documentation: required files (spec.md, proposal.md, task.md, change.md, ADRs), required sections, frontmatter/header conventions.
- Show validation issues in the UI (warnings/errors per artifact).
- Add a rule that flags a placeholder "TBD" (or similar) in the Purpose section of an artifact as a warning.

## ~Allow cancelling a folder read~ ✅ shipped in v2.13.0

- ~~When opening/monitoring an openspec folder, reading the folder's artifacts can take a moment; provide a way to cancel an in-progress folder read (e.g. a cancel button / AbortSignal) so the UI is never stuck waiting.~~

## Comment popup: generic copy

- The comment bubble's textarea placeholder reads "What should be fixed?", which assumes every highlight warrants a change; comments can also be plain observations or questions (the review flow even has an explain mode where the model only answers). Make the placeholder generic (e.g. "Add a comment…"), and review the buttons in the popup (currently **Cancel** / **Save comment**) for the same reason so the wording matches generic commenting rather than fix-requests.

## ~Highlight exactly what changed in a proposal~ ✅ shipped in v1.10.0

- ~~Current change detection is file-level only (lastModified snapshot → "new" marker).~~
- ~~Feasible: snapshot each artifact's raw content in IndexedDB per scan, line-diff old vs new, render the diff (unified view or highlighted lines in the pane).~~
- ~~The File System Access API exposes no previous versions, so content must be snapshotted ourselves.~~

## ~Mark diff (changes) as read~ ✅ shipped in v2.2.0

- ~~Allow marking a file's changes as read; a file is marked automatically as soon as its diff view is opened.~~
- ~~Persist read state so it survives reloads (IndexedDB), and reflect it in the file list (e.g. dim/clear the "new" marker, no longer count it in group counters).~~

## Mark an archived spec as read when opened

- Opening an archived change/spec should mark it as read in one go — no need to open each artifact (proposal, design, task, ADR) inside it individually to clear its "new" marker/counter.
- Persist that read state like the existing file-level read state (IndexedDB), and clear the marker/counter as soon as the archived spec is opened.

## Collapse Config group by default

- The file list's group headers (Changes / Specs / Archive / Config) start expanded except **Archive**, which is collapsed by default on first visit (`osviewer.collapsed` in state.js).
- Collapse the **Config** group by default too: it holds the folder's config.yaml and config/ files, which are rarely the focus when browsing artifacts.
- Keep the persisted per-user choice working as it does for Archive (signal + localStorage).

## Exclude a change's metadata.yaml from unread tracking ✅ shipped in v2.15.0

- ~~The unread/new change tracking should also consider an openspec change's `metadata.yaml` file: when it is created or modified, the change shows as unread (marker + group counter) just like its other artifacts — no need to open it to acknowledge.~~
- Shipped instead as the reverse: a change's metadata file (`.openspec.yaml`) is shown and readable, but is excluded from unread/new tracking. It never places a "new" marker or counts in a group counter, and never needs to be opened to mark the change (or an archived change) as read.

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

## ~Review: generate two types of prompts~ ✅ shipped in v2.12.0

- ~~Extend the review panel to offer two prompt modes from the collected highlights + comments + artifact content:~~
  - ~~**fix/modify** — the current behavior: prompt the LLM to apply the requested changes.~~
  - ~~**explain** — new: user asks the model to explain what was highlighted because it is not clear to them; the prompt asks for an explanation instead of edits.~~
- ~~Add a mode selector in the review panel; the copy-prompt / send-to-LLM action uses the selected mode.~~
- ~~Shipped instead as a single self-describing prompt (no mode selector): it lists each comment as File / Referenced text / Comment and tells the model to disambiguate by intent — fix/adjust/edit the referenced text, or, when the comment is itself a question, explain it without changing the spec; where an edit is needed, keep the rest of the proposal consistent. One **Copy prompt** button replaces the Copy-fix / Send-to-LLM pair and the preview modal is removed entirely.~~

## Collect review history per project

- Persist completed reviews (highlights, comments, chosen prompt mode, sent prompt) per project folder, e.g. in IndexedDB keyed by project.
- Treat them as a history of corrections to enable insight extraction over time: recurring issues, which sections/artifacts get most feedback, process health.
- Keep an eye on storage growth: prune/export/clear old history.

## ~Fuzzy search within all documents' content~ ✅ shipped in v2.3.0

- ~~Add a fuzzy search that matches against the content of all documents (specs, ADRs, tasks, changes), not just filenames/headings.~~
- ~~Search across the whole openspec tree, index artifacts by content in IndexedDB to keep searches fast.~~
- ~~Show results with snippet/matches and link to the containing artifact; highlight matching lines when the artifact is opened.~~
- ~~Use **Fuse.js v7** (vendored as lib/fuse.min.js, UMD loaded off window, re-exported via imports.js — same pattern as marked/js-yaml). Full build with bitap for real fuzzy matching; at ~24KB minified. Load matches index order on file list, reuse its highlight/matches info for snippets.~~

## Over-engineering cleanup (ponytail-audit) ✅ v2.11.2

- ~~Delete one-shot Playwright scripts from archived changes (verify-search.js, tools/verify-review.js)~~ ✅
- ~~Delete dead `matchLines()` export~~ ✅
- ~~Delete dead `derivePrefix()` in app/model.js (store keeps its live copy)~~ ✅
- ~~Delete empty osv-loading constructor~~ ✅
- ~~Collapse the 8 IDB transaction wrappers in app/store.js into a `storeTx()` helper~~ ✅
- ~~Unify the +a −r fragment into `diffCountsHtml()` in app/diff.js~~ ✅
