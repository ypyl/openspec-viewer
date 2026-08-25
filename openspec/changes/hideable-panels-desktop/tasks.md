## 1. Panel state + persistence

- [x] 1.1 Add `reviewHidden` and `sidebarHidden` tiny-signals (default `false`) to `app/state.js`, plus boot-time hydration from `localStorage['osviewer.panels']` (`{ review, sidebar }`, try/catch parse like `readHighlights`) and an effect that persists JSON on change (theme-preference pattern).
- [x] 1.2 Apply `body.hide-review` / `body.hide-sidebar` classes from the signals via a single effect, and remove them at boot when hydration succeeds with visible defaults.

## 2. Desktop header toggles

- [x] 2.1 Add two compact icon buttons (aria-pressed, tooltips: "Hide/show review panel", "Hide/show sidebar") to `osv-header`'s `.side` cluster; click flips the matching signal; an effect syncs `aria-pressed` (nav-toggle pattern).
- [x] 2.2 CSS: toggle buttons styled like `.theme-btn`, hidden below 62em, pressed/active state distinct.

## 3. Review restore pill + hidden rendering

- [x] 3.1 `osv-review` renders a floating restore pill (position: fixed, e.g. bottom-right) when `reviewHidden` is true: a button with aria-label including the item count, count derived from the existing `buildReviewHtml` items (no new counting path), click sets `reviewHidden = false`.
- [x] 3.2 CSS: the pill hidden below 62em; the hide rule targets `.review-drawer` (not the whole `osv-review`) so the pill can render while the drawer is hidden, and `osv-review`'s `min-height: 28vh` is neutralized in the hidden state so the collapsed panel occupies zero layout space.
- [x] 3.3 Verify by test that the drawer is never unmounted: after hide → restore, the list ✕ delete handlers, Copy prompt action, checklist state, and list scroll survive (CSS-only visibility).

## 4. Layout reflow + narrow-screen scoping

- [x] 4.1 Add `@media (min-width: 62em)` rules: `body.hide-review osv-review .review-drawer { display: none }` and `body.hide-sidebar osv-file-list { display: none }`; the pane (`flex: 1`) re-expands automatically — no layout JS.
- [x] 4.2 Verify no rules apply below 62em (mobile auto behavior unchanged: nav drawer unchanged, review hidden unconditionally, toggles and pill absent).

## 5. Version bump (same commit as the UI groups)

- [x] 5.1 Bump all three markers to v3.8.0 in the SAME commit as the UI work: `index.html` first-line comment (`<!-- OpenSpec Local Viewer v3.8.0 -->`), `components/osv-header/osv-header.js` `VERSION = '3.8.0'`, `sw.js` `CACHE_VERSION` (`osviewer-3.8.0`).

## 6. Verification

- [x] 6.1 Run `npm test` — the unit suite (model/diff/search) must stay green; no unit-level behavior changed.
- [x] 6.2 Serve `python -m http.server 8743` and run the existing e2e suite at the default desktop viewport (1280×720 ≥62em) via playwright-cli (`diff-test.js`, `migration-test.js`, `collapse-test.js`, `whole-file-comment-test.js`) — with no saved `osviewer.panels`, panels default visible, so these must stay green.
- [x] 6.3 Write and run `panel-toggle-test.js` at a narrow desktop viewport (~1100px, still ≥62em): clear persisted state → panels visible by default; hide the review panel → pane widens and the pill appears with the correct count; add a comment while hidden → it appears after restore; restore via the pill → delete and Copy prompt still work; toggle the sidebar → hides/shows preserving selection and collapse state; reload → both hidden states are restored; at a <62em viewport the toggles and pill are absent.
- [x] 6.4 Commit everything (UI work and version bump together), push to `master`, wait for the GitHub Pages build (~1 min), and confirm the header badge reads v3.8.0 at https://ypyl.github.io/openspec-viewer/.
- [x] 6.5 Re-shoot `screenshot.png` at 1440×900: the two header panel toggles are new visible chrome at ≥62em, so the default viewport no longer matches the old capture (AGENTS.md: re-shoot when UI changes).