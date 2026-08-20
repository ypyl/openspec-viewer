## Why

The viewer can only find artifacts by filename or change name (the sidebar filter matches `rel` paths), so the content that actually matters — proposal rationale, design decisions, task wording, spec requirements, config — is reachable only by browsing. Users need to answer "where did we write about X?" without knowing which file mentions it. A fuzzy content search over the whole openspec tree, with snippets and one-click jumps into the matching artifact, turns the viewer from a file browser into a document finder.

## What Changes

- Add a header search box ("Search all artifacts…") that fuzzy-searches the content of every artifact file (specs, ADRs/proposals/design/tasks, change metadata, archive, config), not just filenames.
- Results appear in a dropdown under the search box, grouped by section in tree order (Changes, Specs, Archive, Config), each showing an artifact-type badge, a context snippet with the match highlighted, and the file's location/change.
- Clicking a result opens the artifact in its usual surface: a change/archive artifact opens the change with the matching tab active; a spec or config opens the file directly. The matching lines are then highlighted in the pane and scrolled into view.
- The existing sidebar name filter stays unchanged; `Ctrl+K` focuses the header search, `/` keeps focusing the sidebar filter.
- Search uses Fuse.js v7 (Apache-2.0), vendored as `lib/fuse.min.js` and loaded through `imports.js` — the same pattern as marked/js-yaml/DOMPurify. No CDN.
- The search corpus is built from the content snapshots the app already persists in IndexedDB (with a live-read fallback for uploaded folders, which have no snapshots); no new persistent index is stored.
- Keyboard: typing is debounced, single-character queries are ignored, results are capped, `Escape` clears the box.
- Not breaking; new visible feature → **v2.3.0** (MINOR), bumped across all three version markers in the same commit.

## Capabilities

### New Capabilities
- `content-search`: fuzzy search over all OpenSpec document content, snippet-based results, and deep-link navigation from a result into the matching artifact with the matching lines highlighted.

### Modified Capabilities
- None. Adding Fuse as a vendored library satisfies the existing app-delivery "no runtime CDN dependency" requirement; the version bump follows the existing version-marker convention. No app-delivery or change-monitoring requirement changes.

## Impact

- **New asset**: `lib/fuse.min.js` (Fuse v7.0.0, already vendored and verified under Apache-2.0).
- **New component**: header search input + results dropdown (component folder under `components/osv-search/`, registered in `index.js`).
- **Modified modules**: `index.html` (script tag + version marker), `imports.js` (Fuse export), `app/state.js` (search-query/results/active-range signals), `app/store.js` (corpus assembly + index invalidation on scan/load), `app/model.js` (pure snippet/line-mapping helpers, Node-testable), `app/render.js` (re-export), `app/annotations.js` (transient search marks alongside persistent highlights), `components/osv-pane/` (open-at-result + scroll-to-match), `components/osv-file-list/` (unaffected; `/` shortcut preserved), `components/osv-header/` (input placement or reuse via header), `sw.js` (cache version marker).
- **Version markers**: `index.html` first-line comment, header badge, `sw.js` CACHE_VERSION → `2.3.0`, same commit.