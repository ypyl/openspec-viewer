## 1. Add the Ctrl+P search shortcut

- [x] 1.1 In `components/osv-search/osv-search.js`, extend the existing document `keydown` listener (currently matching Ctrl+K / Cmd+K) to also match Ctrl+P / Cmd+P (`e.key.toLowerCase() === 'k' || 'p'`), keeping the existing `preventDefault()` + `input.focus()` + `input.select()`. No other markup, CSS, or behavior change.

## 2. Version bump (same commit as the UI change)

- [x] 2.1 Bump all three markers to v3.13.0 in the SAME commit as 1.1: `index.html` first-line comment (`<!-- OpenSpec Local Viewer v3.13.0 -->`), `components/osv-header/osv-header.js` `VERSION = '3.13.0'`, `sw.js` `CACHE_VERSION` (`osviewer-3.13.0`).

## 3. Verification

- [x] 3.1 Run `npm test` — the unit suite (model/diff/search) must stay green; no unit-level behavior changed.
- [x] 3.2 Add `search-hotkey-test.js` e2e (mirror the folder-pick harness from `diff-test.js`): assert Ctrl+P focuses `.s-input` and selects its contents with the browser print dialog suppressed, that the shortcut works with an artifact open, and that Ctrl+K still focuses the search input; serve `python -m http.server 8743` and run this new test plus the existing default-viewport suite (`diff-test.js`, `migration-test.js`, `collapse-test.js`, `whole-file-comment-test.js`, `panel-toggle-test.js`, `mobile-drawer-test.js`, `review-guidance-test.js`) — all must stay green.
- [x] 3.3 Commit (1.1 + 2.1 + 3.2 together), push to `master`, wait for the GitHub Pages build (~1 min), and confirm the header badge reads v3.13.0 at https://ypyl.github.io/openspec-viewer/. No `screenshot.png` re-shoot needed (hotkey is not visual).