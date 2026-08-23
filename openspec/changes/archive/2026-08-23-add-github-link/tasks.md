## 1. Add the GitHub link to the folder rail

- [x] 1.1 Add static anchor markup to `components/osv-folder-rail/osv-folder-rail.js`: an `<a class="rail-github">` placed after `.rail-list` in the rail's `connectedCallback` markup, with `href="https://github.com/ypyl/openspec-viewer"`, `target="_blank"`, `rel="noopener"`, `title` and `aria-label` = "OpenSpec Viewer on GitHub", and the octicons `mark-github` path as an inline SVG (~20px, `fill: currentColor`). It must be part of the static shell, not the reactive avatar list.
- [x] 1.2 Style it in `components/osv-folder-rail/osv-folder-rail.css`: share the `.rail-add` rule via grouped selector (same 40×40 rounded square, dashed border, transparent background, hover tint), pin it to the bottom of the rail with `margin-top: auto`, and confirm it lands at the end of the horizontal strip on narrow screens (≤ 61.99em). Verify it never shows avatar affordances (no unread dot, no active ring, no letter).

## 2. Version bump

- [x] 2.1 Bump the three markers from 3.2.0 to 3.3.0 (MINOR — new visible feature) in the same commit: `index.html` first-line comment, `components/osv-header/osv-header.js` `VERSION`, and `sw.js` `CACHE_VERSION` (`osviewer-3.3.0`).

## 3. Verification

- [x] 3.1 Serve the folder (`python -m http.server 8743`) and verify via playwright-cli: the GitHub link is the last element of the folder rail; it renders at the same size and shape as the rail's add button; its `href` is `https://github.com/ypyl/openspec-viewer`, `target="_blank"`, `rel="noopener"`, and its `aria-label`/`title` read "OpenSpec Viewer on GitHub"; clicking it opens the repo in a new tab without navigating the app page; and at a narrow viewport it stays visible at the end of the rail strip.
- [x] 3.2 Run the existing e2e regression tests (diff-test.js and migration-test.js) against the local server and confirm they pass (rail markup change must not break folder add/switch/activate flows).
- [x] 3.3 Push to `master`, wait for the GitHub Pages build (~1 min), and confirm the header badge on https://ypyl.github.io/openspec-viewer/ shows v3.3.0 and the GitHub link appears in the deployed app.