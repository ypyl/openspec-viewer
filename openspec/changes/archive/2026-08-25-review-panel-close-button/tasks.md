## 1. Panel close control

- [x] 1.1 Add a `.review-head` title row inside `osv-review`'s `.review-drawer` markup: a "Review" label and a `.review-close` button (✕, aria-label/title "Close review panel") above the checklist; click sets `reviewHidden.value = true` (existing signal — no state changes).
- [x] 1.2 CSS for `.review-head` (slim row, flex-shrink: 0, subdued label, hover state on the ✕ like the existing `rv-del` treatment); it is inside the drawer, so it disappears automatically below 62em with the panel.
- [x] 1.3 Focus continuity: when the close button hides the panel, focus the restore pill (present whenever the panel is hidden).

## 2. Header: remove the review toggle

- [x] 2.1 Remove the `.toggle-review` button from `osv-header` markup, its click handler, and its aria-pressed effect; remove the `reviewHidden` import and wiring for it (the sidebar `.toggle-sidebar` and its effect stay).
- [x] 2.2 Remove the `.toggle-review`-specific CSS (the shared `.panel-toggle` style stays for the sidebar button); confirm the header right cluster still lays out cleanly with one fewer button.

## 3. Version bump (same commit as the UI groups)

- [x] 3.1 Bump all three markers to v3.9.0 in the SAME commit as the UI work: `index.html` first-line comment (`<!-- OpenSpec Local Viewer v3.9.0 -->`), `components/osv-header/osv-header.js` `VERSION = '3.9.0'`, `sw.js` `CACHE_VERSION` (`osviewer-3.9.0`).

## 4. Verification

- [x] 4.1 Run `npm test` — the unit suite (model/diff/search) must stay green; no unit-level behavior changed.
- [x] 4.2 Update `panel-toggle-test.js`: replace every `.toggle-review` interaction with `osv-review .review-close`; assert the header shows NO review toggle (and the sidebar toggle still exists); keep the pill-count, add-while-hidden, restore, delete/copy, sidebar, persistence, and mobile scenarios — the review hide path now goes through the panel close button.
- [x] 4.3 Serve `python -m http.server 8743` and run the updated e2e at the narrow desktop viewport (~1100px) plus the default-viewport suite (`diff-test.js`, `migration-test.js`, `collapse-test.js`, `whole-file-comment-test.js`, `mobile-drawer-test.js`, `review-guidance-test.js`) — all must stay green.
- [x] 4.4 Re-shoot `screenshot.png` at 1440×900 (the header loses the `▣` button and the review panel gains its title row with the close button); delete the scratch script and `.playwright-cli/` junk after.
- [x] 4.5 Commit everything (UI work, test updates, version bump, screenshot together), push to `master`, wait for the GitHub Pages build (~1 min), and confirm the header badge reads v3.9.0 at https://ypyl.github.io/openspec-viewer/.