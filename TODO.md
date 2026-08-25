# TODO

## Allow hiding the left/right panels

**Done — implemented in v3.8.0 (`hideable-panels-desktop`; open change, not yet archived).**

- Working on a small screen is cramped, even on desktop with a narrow window: add a
  manual affordance to collapse/hide the left file-list sidebar and/or the right
  review drawer (two header toggle buttons at ≥62em), giving the pane the full width.
  The folder rail stays pinned (60px toolbar-like column).
- Mobile already auto-hides both sides (rail + sidebar behind the ☰ drawer, review
  hidden outright below 62em); the desktop toggles are about user control the rest of
  the time. A hidden review drawer is restored via a floating 💬 pill carrying the
  item count, so adding/deleting comments and copying the prompt stay possible.

## Add an in-app guide

- The app has no built-in help for a new user: add a discoverable guide (e.g. a help
  panel/section, or onboarding copy in the empty states) that explains how to use the
  app, available on first load and on demand.
- Cover the core flows: open the app (needs http(s) — serve via `python -m http.server
  8743` or use the hosted build; file:// shows a "needs a web server" page; installable
  for offline use); add a folder (＋ in the left rail, File System Access picker with an
  upload fallback, multiple folders each with their own avatar/tabs/unread state);
  browse (Changes / Specs / Archive / Config groups, a change's Proposal / Spec(s) /
  Design / Tasks / Metadata tabs, live dot + 10 s polling, open files hot-refresh);
  diff (Diff button next to the breadcrumb, line-by-line unified diff that survives
  reloads); review (select text in an artifact → comment, or whole-file comment from
  the artifact header; two-minute checklist; one **Copy prompt** action folding
  highlights/comments + artifact content into a single self-describing LLM prompt);
  search (header full-text with match highlighting, sidebar file filter); theme
  (dark/light follows the system unless overridden in the header).
- Stay plain-vanilla and offline-capable: static content in the app itself (same
  pattern as the vendored `app/review-guide.js`) — no new dependencies, no runtime
  fetch.

### Exploration notes (2026-08-24, explore mode with pi — pick up here later)

- Draft scope came from the app-usage walkthrough below (open, add folder, browse,
  diff, review, search, theme) plus the serving caveat (file:// shows the "needs a
  web server" page, installable for offline use).
- Open questions: where the guide lives in the UI (help panel in the header vs
  onboarding on first load vs both), how it responds to empty/no-folder states, and
  whether the review checklist/guidance content gets folded in.

## Collect review history per project

- Persist completed reviews (highlights, comments, sent prompt) per project folder, e.g. in IndexedDB keyed by project. ("chosen prompt mode" is stale — the mode selector was dropped in v2.12 for a single self-describing prompt.)
- Treat them as a history of corrections to enable insight extraction over time: recurring issues, which sections/artifacts get most feedback, process health.
- Keep an eye on storage growth: prune/export/clear old history.

### Exploration notes (2026-08-23, explore mode with pi — pick up here later)

**Grounding — what already exists:**
- Highlights/comments are NOT ephemeral: they persist per folder in localStorage (`osviewer.highlights.<folderId>`), keyed rel → [items], and survive reloads. The real gaps are temporal record (deleted comments, copied prompts are gone), no "completion" concept, no aggregation, and checklist non-persistence.
- Checklist ticks (7-item, from add-review-guidance/design D4) are session-only by design, and the shipped delta spec says "Checklist state SHALL NOT be written to persistent storage". Persisting ticks later ⇒ must amend that requirement in the change's delta.
- Each highlight item already stores `lines` (1-based line numbers) → section-heading attribution is feasible via a sectionOf(raw, line) helper at capture time.
- Copy prompt is the terminal review action (osv-review copy-btn); no review "instance" exists in the model today — just a folder-wide bag of comments.

**Design fork — what is "a completed review"?**
- A) Snapshot-on-Copy: log { folderId, ts, prompt, items, checklist? } on every prompt copy. Zero ceremony, captures what was told to the LLM; "copy" ≠ "applied", weak scope notion.
- B) Per-change review records: open/complete a review of change X → one record { changeKey, ts, checklist, prompt, items }. Honest unit, matches how people work; needs a new affordance (fold/complete review).
- C) Event log: append-only add/delete/edit comment stream. Richest temporal view (issue re-flagged after fixing); most code/storage, least UI.
- Lean: A now (laziest, ~80% of value), B grows out of it (changeKey derivable per comment via changeOf(rel)) without inventing a review-lifecycle UI.

**Insight extraction — two costs:**
- Derived stats (built-in counts per artifact kind / change / section): feasible via `lines`, but "recurring issues" (semantic clustering of comment text) is genuinely hard locally.
- LLM history prompt (on-brand, recommended): add an "Analyze my review history" action that folds past reviews into a prompt; the model does clustering/ranking. ~free vs analytics; fits the app's collect → prompt → LLM thesis; also sidesteps local fix-vs-question intent classification.

**Storage:**
- Records are ~1–5 KB; a decade of weekly reviews ≈ 500 records ≈ 2.5 MB — non-problem in IndexedDB.
- Defensive: cap last N per folder + explicit clear + export as markdown/JSON.
- IndexedDB v3→v4 `reviews` store, folder-keyed; cursor-delete-by-folder pattern already exists (clearFolderSnapshots in app/store.js).

**Tensions to decide:**
- Closing a folder today deletes its snapshots + row. Does history survive close/re-add? (lean: survive — it's a corrections log, not live state.)
- Upload folders are session-only (no persisted id) → skip history for them (lean) or key by synthetic name.
- Phase it: phase 1 = capture (records + clear/export, clean MINOR), phase 2 = insights (LLM history prompt). Separable; phase 1 is a clean standalone change.

**Open threads (unresolved):**
1. Unit: A / B / C, or A now and B later?
2. Insights: derived stats UI, LLM history prompt, or both phased?
3. Does history survive closing a folder — and is it visible when no folder is open?
4. Visible history surface in phase 1 (review panel section / header action) or storage + export only?
5. Checklist persistence: amend the shipped "SHALL NOT persist" requirement, or keep ticks out of history entirely?
