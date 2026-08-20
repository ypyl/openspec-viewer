## Context

The viewer already persists the raw text of every artifact: the IndexedDB `snapshots` store holds `{ rel, text, mtime, readHash, unread }` per file, written by the 10s scan loop on first read and on every content change, and deleted when a file disappears. That store is the change-diff baseline and is reload-safe, so it is also a complete, always-fresh search corpus — no new persistent data structure is needed. The only gap is the file-upload fallback (`loadFiles`), which never snapshots; there the corpus falls back to a live read per file.

The pane renders into light DOM and `applyHighlights(rel)` runs after every render as the onRendered hook. `annotations.js` already has a `wrapHighlight(container, h)` that wraps a raw-text `[start, end]` range across rendered text nodes via a TreeWalker, re-anchoring by substring if the file changed. Navigation into a change already supports landing on a specific artifact: `openChange(key, initialRel)` computes which tab starts active from `initialRel`. The sidebar owns a name filter bound to `/`; the header owns theme, stats, review.

Fuse.js v7.0.0 is already vendored at `lib/fuse.min.js` (Apache-2.0) and wired into `imports.js`/`index.html`; this change builds on that.

## Goals / Non-Goals

**Goals:**
- A header search box that fuzzy-searches all artifact content and shows grouped snippet results.
- One-click navigation from a result into the artifact's usual surface with the match highlighted and scrolled into view.
- Results always reflect the current folder state (survive scans, reloads, and both loading modes) with no new persistence.
- Pure, Node-testable search helpers consistent with the existing `tools/test-*.mjs` pattern.

**Non-Goals:**
- Replacing or removing the sidebar name filter.
- A persistent Fuse index in IndexedDB (snapshots already persist the corpus; rebuilding the index in memory is sub-millisecond to low-millisecond at these corpus sizes).
- Search alternatives/facets beyond the single query box, or pagination.
- URL routing for search state.

## Decisions

### D1: Corpus source — IDB snapshots with live-read fallback, no new persisted index

The corpus is assembled per session: for each file in `allFiles`, take its snapshot text from `snapshots` when present, else read the file live. A Fuse index is built in memory on demand and cached; the scan loop and `loadFiles` bump a `searchVersion` when anything changed, invalidating the cache.

- **Why**: the snapshots are already written/appended/removed by the existing scan, so correctness falls out of existing behavior with no invalidation bookkeeping of its own.
- **Alternative rejected**: persisting the Fuse index (or corpus) in a new IDB store. Official guidance in the TODO, but it duplicates data we already store, adds a migration/versioning surface, and buys little: rebuilding Fuse over a typical openspec tree (tens to a few hundred small markdown files) is fast. Revisit only if a folder grows to thousands of files.

### D2: Fuse configuration — two weighted keys, typo-tolerant, whole-text

Each artifact is one record: `{ rel, title, text }` where `title` is the change label / capability name / file name (`displayLabel`-derived) and `text` is the raw file content (frontmatter included — keeps offsets exact and makes config content searchable). Fuse options: `keys: [{ name: 'title', weight: 3 }, { name: 'text', weight: 1 }]`, `includeMatches: true`, `includeScore: true`, `minMatchCharLength: 2`, `ignoreLocation: true`, `threshold: 0.25`, result cap (~24) applied per group.

Multi-word queries use **AND semantics**: the query is split into terms, each term is searched, and an artifact is returned only when it matches *every* term (scores are summed for ordering). This prevents a phrase like "new item" from surfacing artifacts that happen to contain just one common word, which OR-style fuzzy matching did.

Highlights are computed from **exact, case-insensitive term occurrences** in the artifact text, not Fuse's match ranges: Fuse's fuzzy ranges are per-character and render as noise (scattered 1-2 char marks like "iewe" or "ti"). When a term has no exact occurrence (a typo), the search falls back to Fuse's fuzzy range for that term so the matched word is still shown.

- **Why title weighs more**: a hit in a change name is more relevant than an incidental word late in a body; Fuse's default location bias is disabled (`ignoreLocation`) so deep-in-document matches still surface, which matters for long specs.
- **Why raw text**: match indices from Fuse point into the original string, so snippets and pane highlights need no offset translation.
- **Why AND + threshold 0.25**: strict but typo-tolerant word-by-word — a near-exact term match counts, a loose substring alignment does not — and multi-word queries must match every term.
- **Alternative considered**: stripping frontmatter/markdown before indexing to reduce noise. Rejected for now: it complicates offsets and hides config/metadata content; the 2-char minimum already filters the worst noise.

### D3: Two search surfaces, two shortcuts

The header content search and the sidebar name filter coexist. `Ctrl+K` (also `Cmd+K`) focuses the header search; `/` stays focused on the sidebar filter (its existing binding is preserved verbatim). `Escape` clears and closes the header search.

- **Why**: the sidebar filter is a structural narrowing tool; the header search is a find-anywhere tool with a different output (snippets → navigation). Merging them would lose in-place tree filtering.

### D4: Snippets and match lines from pure helpers in `model.js`

A pure function maps a doc's Fuse `matches` (character index ranges per key) into (a) snippet segments — a window of ±2 lines around the first match, split into plain/`<mark>` parts for html-literal — and (b) the set of 1-based matched line numbers. `model.js` stays DOM-free, so a new `tools/test-search.mjs` node test covers it without a browser, mirroring `tools/test-model.mjs`.

- **Why**: keeps all text math testable in plain Node (same constraint that already keeps `model.js` importing only html-literal), and keeps the component code thin.

### D5: Search highlight marks are transient siblings of annotation marks

When a result is opened, the matched text is highlighted with the same wrap machinery as persisted annotations (`wrapHighlight`) but with a distinct class (`mark.sq`, no `data-id`, no click handler) and held in a dedicated signal (`searchMarks`) rather than the persistent `highlights` map. `applyHighlights(rel)` — the existing after-render hook — renders both kinds: unwrap `mark.sq` + `mark.hl`, then re-wrap both. The reveal handler opens the artifact (see D6), then scrolls `scrollIntoView` to the first `mark.sq`, mirroring the existing annotation-reveal behavior. Search marks are cleared when the query is cleared or a different artifact is opened, so they never accumulate or persist.

- **Why reuse**: `wrapHighlight` already solves the hard problems — mapping raw offsets onto rendered markdown DOM, not spanning block boundaries, re-anchoring when content shifted.
- **Why class separation**: `applyHighlights` already unwraps only `mark.hl`, so the two systems coexist without recursive unwrapping; search marks on a later visit are simply gone.

### D6: Deep-link navigation reuses the existing open events

Clicking a result dispatches the same navigation events the sidebar uses, with the artifact filled in: an artifact inside a change/archive dispatches the change-open path with that artifact as the initial tab (`openChange(key, rel)`), a standalone spec/config dispatches the direct-open path (`openFile(rel)`). Optimization: when the target change is already open, `activateTab(i)` is called instead of re-rendering the whole change, so the current scroll position is preserved; the marks+scroll then apply after the render completes.

### D7: Search UI is its own component nested in the header

A new `components/osv-search/` (input + dropdown results, own CSS, registered in `index.js`) is placed in the header between the stats and the review button. The header keeps its thin responsibilities; the search box has enough state (query, results, focus, keyboard nav) to warrant isolation.

### D8: Version was pushed to v2.3.0 by the proposal

New visible feature → MINOR. The commit that implements this bumps all three markers together: `index.html` first-line comment, header badge, `sw.js` CACHE_VERSION.

## Risks / Trade-offs

- [Fuse on very large folders (thousands of docs) could make per-keystroke search slow] → Debounce input (~120ms), cache the built index, cap results, and treat indexing time as an open question to measure; if it regresses, reduce `threshold` or index at load time.
- [Fuzzy matches on prose can be surprising ("why did this match?") for common short words] → `minMatchCharLength: 2`, `threshold: 0.5`, and the snippet always shows the matched context so the user can judge; threshold stays a tunable.
- [Transient search marks can nest inside persistent annotation marks when the same text is both annotated and searched] → Marks only the opened match; search marks are unwrapped on every render and never persisted; worst case is one nested `<mark>` that disappears on the next artifact open.
- [Snapshot corpus misses upload-mode folders] → Live-read fallback in the corpus builder (D1); covered by a spec scenario.
- [Header space is tight on narrow screens (title + version + stats + search + theme + review)] → Search input shrinks to a flexible width and the dropdown is full-width overlay; verify at small widths in the e2e pass.

## Migration Plan

No data migration (no new IDB stores, no schema change). Deployment is the usual static push; the bumped service-worker cache version guarantees returning users fetch the new asset graph, including `lib/fuse.min.js`. Rollback is reverting the release commit (version markers revert together).

## Open Questions

- The result cap, weight ratio, and debounce window are defaults chosen from
  experience; they are testable knobs, not structural choices, and can be
  adjusted during implementation without touching the specs, approach, or task
  breakdown. The fuzzy `threshold` was tuned down to 0.25, multi-word queries
  switched to AND semantics, and highlights moved to exact term occurrences in
  response to false-positive / noise-highlight feedback. Query terms shorter
  than three characters are ignored entirely (no 2-char matching/highlighting).
- Whether clicking a result should also auto-reveal/scroll the artifact in the sidebar list (two-pane coordination) is deferred: the pane jump satisfies the spec scenarios as written.