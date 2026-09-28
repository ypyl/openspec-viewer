## 1. Footer row in the change view

- [x] 1.1 In `components/osv-pane/osv-pane.js`, render a footer row as a sibling of `.pane-body` inside the change view template in `openChange`, and leave it out when the change has fewer than two artifact tabs. Verify: opening a change with a proposal and a design shows the row after the content, opening a single-artifact change shows no row, and opening a standalone main spec or config file shows no row.
- [x] 1.2 Style the row in `components/osv-pane/osv-pane.css`: separated from the content above by a top border, two compact controls, a muted disabled state, and wrapping on narrow viewports. Verify: at 1440px and at a phone width the row sits after the content, the disabled control reads as muted, and the row does not overlap the content.
- [x] 1.3 Bump the version to **v3.18.0** in the same commit: the `index.html` first-line comment, `export const VERSION` in `components/osv-header/osv-header.js`, and `CACHE_VERSION` in `sw.js` (`osviewer-3.18.0`). Verify: all three markers read 3.18.0 and the header badge renders `v3.18.0`.

## 2. Footer navigation behavior

- [x] 2.1 Handle footer clicks in the delegated click listener already attached to `main`, adding one branch alongside `.guide-toggle` and `.diff-toggle` that switches to the adjacent artifact through `activateTab`. Verify: clicking Next advances the active tab and replaces the body content; clicking Previous returns.
- [x] 2.2 Populate the footer's labels and disabled states in `activateTab`, deriving both from `currentTabs` and the active artifact's index. Verify: on the first tab Previous is disabled, on the last tab Next is disabled, and each control's label matches the adjacent tab's label.
- [x] 2.3 Confirm navigation reuses `activateTab` unchanged, so scroll reset and acknowledgment are inherited: moving with the footer opens the target scrolled to its top, and an artifact with a pending diff stays unread after moving to it. Verify: open a change whose design has a pending diff, move to Design with the footer, and confirm the view starts at the top while the design's diff badge remains.

## 3. Verification

- [x] 3.1 Add `tab-nav-test.js` at the repo root following the existing stub-`showDirectoryPicker` Playwright pattern, covering row presence on a multi-artifact change, labels, disabled ends, no wraparound, scroll-to-top after moving, and absence of the row for a standalone artifact. Verify: serve with `python -m http.server 8743` and run `playwright-cli run-code --filename=tab-nav-test.js`, reporting the results.
- [x] 3.2 Run the existing end-to-end tests (`diff-test.js`, `migration-test.js`, `review-guidance-test.js`, `panel-toggle-test.js`) against the local server to confirm no regression, and report the results.
- [x] 3.3 Re-shoot `screenshot.png` with the footer visible, using the documented scratch script flow. Verify: the screenshot shows the footer after an open change's content, and after pushing to `master` the deployed header badge reads `v3.18.0`.
