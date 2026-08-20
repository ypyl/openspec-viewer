# Tasks: open review panel as a side panel

## 1. Move review into the layout

- [x] 1.1 In `index.html`, move `<osv-review>` inside the `.layout` container, after `<osv-pane>`, so it participates in the flex row as the third column (file list | pane | review).
- [x] 1.2 In `styles/global.css`, confirm `.layout` stretches children to equal height for the three-column row (e.g. `align-items: stretch`) without disturbing the mobile stacked layout; the pane already has `flex: 1; min-width: 0`.

## 2. Restyle review as an in-place column (desktop)

- [x] 2.1 In `components/osv-review/osv-review.css`, add a desktop media query (≥80em) that makes the host `osv-review` the column: `width: 0; overflow: hidden; transition: width .22s ease;` and `osv-review:has(.review-drawer.open) { width: 380px; }`.
- [x] 2.2 In the same media query, restyle `.review-drawer` for in-place layout: `position: static; width: 100%; height: 100%; transform: none; box-shadow: none; border-left: 1px solid var(--border);` while keeping `display: flex; flex-direction: column` and the internally scrolling `.review-list`.
- [x] 2.3 Verify no JS changes are needed: the `open` class on `.review-drawer`, the open/close/toggle events, the header button active state, and `osv:review-visibility` keep working unchanged.

## 3. Preserve narrow-screen fallback

- [x] 3.1 Keep the existing `position: fixed` overlay rules as the base (below 80em) rules in `osv-review.css` so the drawer still overlays on narrow/mobile widths, matching the current behavior.
- [x] 3.2 Confirm the media query scoping is correct: below 80em the overlay behavior is used and the pane is not squeezed; at/above 80em the in-place column behavior is used.

## 4. Verify behavior

- [x] 4.1 Manual check — open a folder, highlight some text, confirm the panel opens and the content pane visibly reflows (shrinks) beside it rather than being covered, on a wide (≥1280px) viewport.
- [x] 4.2 Manual check — close the panel (header button, ✕ button) and confirm the pane expands back to full width; reopen and confirm the animation is smooth with no layout jump.
- [x] 4.3 Manual check — on a narrow viewport (<1280px), confirm the review still opens as the overlay drawer and the pane returns to full width when closed.
- [x] 4.4 Manual check — confirm review interactions still work: clicking a review item reveals the comment's location, Copy-fix / Send-to-LLM actions behave, and the header count badge updates.

## 5. Version bump

- [x] 5.1 Bump to v2.4.0 in the SAME commit across all three markers: `index.html` first-line comment (`<!-- OpenSpec Local Viewer v2.4.0 -->`), the header badge (`v2.4.0` in `osv-header.js` `VERSION`), and `sw.js` `CACHE_VERSION` (`osviewer-2.4.0`).

## 6. Ship

- [ ] 6.1 Commit and push to `master`; after the GitHub Pages build (~1 min), open https://ypyl.github.io/openspec-viewer/ and confirm the header badge reads v2.4.0 (optionally verify the panel reflow in the hosted build).
