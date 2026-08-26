## 1. Unify the review toggle icon

- [x] 1.1 In `components/osv-header/osv-header.js`, change the `.toggle-review` button's glyph from ▣ to ☰ in the inline header template. No markup structure, class, wiring, or CSS change — the existing shared corner-toggle styling and `reviewHidden` effect already apply.

## 2. Version bump (same commit as the UI change)

- [x] 2.1 Bump all three markers to v3.12.1 in the SAME commit as 1.1: `index.html` first-line comment (`<!-- OpenSpec Local Viewer v3.12.1 -->`), `components/osv-header/osv-header.js` `VERSION = '3.12.1'`, `sw.js` `CACHE_VERSION` (`osviewer-3.12.1`).

## 3. Verification

- [x] 3.1 Run `npm test` — the unit suite (model/diff/search) must stay green; no behavior changed.
- [x] 3.2 Confirm `panel-toggle-test.js` needs no glyph assertions (it checks presence/aria only); serve `python -m http.server 8743` and run it at the narrow desktop viewport (~1100px) plus the default-viewport suite (`diff-test.js`, `migration-test.js`, `collapse-test.js`, `whole-file-comment-test.js`, `mobile-drawer-test.js`, `review-guidance-test.js`) — all must stay green, and the review panel must still open/close via the ☰ header toggle.

  > Note: `panel-toggle-test.js` was stale at HEAD — it still drove comments via the removed `.comment-toggle`/`.cf-text` controls (v3.11.0-era). Updated it to the current whole-file flow (select change title → `.ann-text`/`.ann-save`, same as `whole-file-comment-test.js`). Test-only fix; app code untouched by it.
- [x] 3.3 Re-shoot `screenshot.png` at 1440×900 (the header's top-right toggle now shows ☰); delete the scratch script and `.playwright-cli/` junk after.
- [x] 3.4 Commit (1.1 + 2.1 + 3.3 together), push to `master`, wait for the GitHub Pages build (~1 min), and confirm the header badge reads v3.12.1 at https://ypyl.github.io/openspec-viewer/.