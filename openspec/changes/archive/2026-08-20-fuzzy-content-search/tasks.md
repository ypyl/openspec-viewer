## 1. Search core (corpus, index, pure helpers)

- [x] 1.1 Add a corpus builder (in `app/store.js`): for each file in the current `allFiles`, produce a search record `{ rel, title, text }` where `text` comes from the IndexedDB snapshot when present, else a live read (`readFileText`) for upload-mode files, and `title` is derived from the existing `displayLabel`/`prettyChangeName` helpers; export the builder.
- [x] 1.2 Add a `searchVersion` signal (in `app/state.js`); bump it in `loadFiles`, in `startMonitoring`, and in `scan` whenever content changed or files were added/removed, so the search index is invalidated exactly when the corpus could have changed.
- [x] 1.3 Add pure, DOM-free helpers to `app/model.js`: (a) record-title derivation reused by the corpus builder, (b) snippet builder that turns a document's match ranges into a context window (±2 lines) of html-literal segments with the matched spans wrapped for highlighting, (c) a matcher that maps match ranges to 1-based matched line numbers.
- [x] 1.4 Add `app/search.js`: build a Fuse instance (imported via `imports.js`) over the corpus with `keys: [{ name: 'title', weight: 3 }, { name: 'text', weight: 1 }]`, `includeMatches`, `includeScore`, `minMatchCharLength: 2`, `ignoreLocation: true`, `threshold: 0.5`; cache the index keyed by `searchVersion`; expose a query function that returns per-result match ranges, grouped later by the UI.
- [x] 1.5 Add `tools/test-search.mjs` node tests covering the pure `model.js` helpers (snippet windows, matched-line mapping, title derivation) and run them with `npm test`; the existing model/diff suites stay green.

## 2. Search UI (header component)

- [x] 2.1 Create `components/osv-search/` (js + css) with the search input and results dropdown; register it in `index.js` and place it in the header between the stats and the review button.
- [x] 2.2 Render grouped results in the dropdown: section headings in tree order (Changes, Specs, Archive, Config), per-result artifact-type badge + location label (change name or rel path), and the snippet with the matched text visually highlighted; show the bounded cap and a clear empty state for no matches.
- [x] 2.3 Wire interaction: debounce input (~120ms), ignore queries shorter than 2 characters, `Ctrl+K`/`Cmd+K` focuses the box, `Escape` clears and closes it, clicking outside closes the dropdown, and the existing `/` sidebar-filter shortcut keeps working.
- [x] 2.4 Style the dropdown (overlay, grouped list, highlighted match styling) in `osv-search.css`; keep the header usable on narrow screens (flexible input width, full-width dropdown).

## 3. Deep-link navigation + version bump (user-visible)

- [x] 3.1 Add a transient `searchMarks` state (signal, keyed by rel with raw match ranges) and extend `applyHighlights(rel)` to render them alongside persisted annotation marks using the existing wrap machinery but with a distinct class (`mark.sq`, no click handler, no persistence); clear them on every re-apply.
- [x] 3.2 Add the result-click handler: for an artifact inside a change/archive open that change with the artifact's tab active (`openChange(key, rel)`, or `activateTab(i)` when the change is already open), for a standalone spec/config open the file directly; after the pane renders, scroll the first `mark.sq` into view (mirroring the annotation reveal).
- [x] 3.3 Clear transient search marks when the user clears the search query or opens a different artifact, so they never accumulate or persist across sessions.
- [x] 3.4 Bump the version to **v2.3.0** across all three markers in the same commit as this user-visible change: `index.html` first-line comment, header badge, and `sw.js` CACHE_VERSION.

## 4. Verification

- [x] 4.1 Run `npm test` (node unit suites, including the new search tests) and confirm everything passes.
- [x] 4.2 Run the existing Playwright e2e suites (`diff-test.js`, `migration-test.js`) against `python -m http.server 8743` and report results.
- [x] 4.3 Manually verify the spec scenarios end-to-end: searches hit change proposals, standalone specs, archived changes, and config; a typo'd query still matches; matching lines are highlighted and scrolled into view when a result opens the right surface (tabbed change view vs direct file); search works for an upload-loaded folder; a file added/removed during live monitoring appears/disappears from results without reloading.
- [x] 4.4 Push to `master` and confirm the GitHub Pages deploy shows the v2.3.0 badge and fresh assets (service worker cache updated).