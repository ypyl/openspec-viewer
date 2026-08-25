## 1. Review panel header toggle (top-right corner)

- [x] 1.1 Add a `.toggle-review` button to `osv-header`'s `.side` cluster after the stats (the far top-right corner), glyph ▣, aria-pressed + aria-label/title synced to `reviewHidden` via an effect (sidebar-toggle pattern); click flips `reviewHidden`.
- [x] 1.2 CSS: extend the corner-toggle selector group to `osv-header .nav-toggle, osv-header .toggle-review { ... }` (same 30×30 bordered look) and share the `[aria-pressed="true"]` accent treatment; add `@media (max-width: 61.99em) { osv-header .toggle-review { display: none } }`.

## 2. Remove the in-panel close control and the restore pill

- [x] 2.1 `osv-review`: remove the `.review-head` row and `.review-close` button (markup, click handler, focus-on-close wiring) and their CSS.
- [x] 2.2 `osv-review`: remove the `.review-pill` restore control — markup, `syncPill` effects, the focus-on-close reference, and CSS — so the review panel's only controller is the header toggle; nothing else may toggle `reviewHidden`.
- [x] 2.3 `review-guidance-test.js`: revert the head assertions to the original guard (no `.review-head` / `.review-title` element) now that the head row is gone.

## 3. Version bump (same commit as the UI groups)

- [x] 3.1 Bump all three markers to v3.11.0 in the SAME commit as the UI work: `index.html` first-line comment (`<!-- OpenSpec Local Viewer v3.11.0 -->`), `components/osv-header/osv-header.js` `VERSION = '3.11.0'`, `sw.js` `CACHE_VERSION` (`osviewer-3.11.0`).

## 4. Verification

- [x] 4.1 Run `npm test` — the unit suite (model/diff/search) must stay green; no unit-level behavior changed.
- [x] 4.2 Update `panel-toggle-test.js`: drive the review panel with the header `.toggle-review` button, drop every pill assertion, and assert the pill and in-panel ✕ no longer exist; keep the width-reflow, add-while-hidden, restore, delete/copy, sidebar, persistence, reload, and mobile scenarios.
- [x] 4.3 Serve `python -m http.server 8743` and run the updated e2e at the narrow desktop viewport (~1100px) plus the default-viewport suite (`diff-test.js`, `migration-test.js`, `collapse-test.js`, `whole-file-comment-test.js`, `mobile-drawer-test.js`, `review-guidance-test.js`) — all must stay green.
- [x] 4.4 Re-shoot `screenshot.png` at 1440×900 (the header gains the ▣ corner toggle and the panel loses its head row); delete the scratch script and `.playwright-cli/` junk after.
- [x] 4.5 Commit everything (UI work, test updates, version bump, screenshot together), push to `master`, wait for the GitHub Pages build (~1 min), and confirm the header badge reads v3.11.0 at https://ypyl.github.io/openspec-viewer/.