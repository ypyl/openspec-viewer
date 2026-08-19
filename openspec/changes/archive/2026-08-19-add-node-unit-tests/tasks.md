## 1. Isolate the pure core

- [x] 1.1 Create `app/model.js` with the pure, DOM-free helpers moved from `render.js` (`normPath`, `artifactOf`, `isRelevant`, `isArchived`, `groupOf`, `displayLabel`, `changeOf`, `prettyChangeName`, `derivePrefix`, `snippet`, `refLines`, `crumbFor`), importing only from `../lib/html-literal.js`
- [x] 1.2 Update `render.js` to keep the browser renderers and re-export the moved helpers so existing importers work unchanged
- [x] 1.3 Make `app/diff.js` pure: change `diffViewHtml(rel)` → `diffViewHtml(di)` and `diffToggleHtml(rel, active)` → `diffToggleHtml(rel, di, fresh)`; drop the `state.js` and `imports.js` imports, import `html`/`joinHtml` from `../lib/html-literal.js`
- [x] 1.4 Update `state.js` and `store.js` to import the pure helpers from `app/model.js` instead of `render.js`
- [x] 1.5 Update `components/osv-pane/osv-pane.js` to call `diffViewHtml(di)` / `diffToggleHtml(rel, di, fresh)` with `diffInfo.get(rel)` and `freshDiffs.has(rel)`
- [x] 1.6 Verify `node --check` passes on every changed module and that `app/model.js` and `app/diff.js` import cleanly in Node with no `window` reference

## 2. Add the Node unit-test tooling

- [x] 2.1 Add a minimal `package.json`: `"type": "module"`, private, and a `test` script `node --test "tools/test-*.mjs"` (no dependencies)
- [x] 2.2 Create `tools/test-diff.mjs` — `node --test` cases for `splitLines`, `diffLines` (identical/replace/add/remove/context-window/oversize fallback), `hunkHeader`, `diffHunksHtml`, `diffHint`, `diffTabBadgeHtml`, migrating the equivalent in-browser assertions from `diff-test.js`
- [x] 2.3 Create `tools/test-model.mjs` — `node --test` cases for the classifier: `normPath`, `groupOf`, `changeOf` (active/archived), `displayLabel`, `artifactOf`, `isRelevant`/`isArchived`, `prettyChangeName` (with/without date prefix), `derivePrefix`, `crumbFor`, `snippet`
- [x] 2.4 Remove the "Unit tests against the page's own functions" block from `diff-test.js` (keep its integration assertions); trim the `window` test bridge in `app/testbridge.js` to what the remaining e2e tests actually use
- [x] 2.5 Confirm the full Node suite passes with zero output warnings: `node --test "tools/test-*.mjs"`

## 3. Version and verify

- [x] 3.1 Bump all three version markers to 2.0.1 in the same commit: `index.html` first-line comment, header badge, `sw.js CACHE_VERSION` → `osviewer-2.0.1`
- [x] 3.2 Re-run the Playwright e2e suites (`diff-test.js`, `migration-test.js`) against `python -m http.server 8743` and confirm they still pass
- [x] 3.3 Manual sanity pass: boot the app over HTTP(S) and confirm the file list, diff toggle/view, and tabs render identically (no behavior regression)