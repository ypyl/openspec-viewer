# AGENTS.md

OpenSpec Local Viewer: multi-file vanilla SPA (no build step, no framework,
ES modules, web components), auto-deployed to GitHub Pages from `master`.

## Version bump (same commit as the change)

MAJOR = breaking · MINOR = new feature · PATCH = invisible fix. Keep in sync:

- `index.html` first line: `<!-- OpenSpec Local Viewer vX.Y.Z -->`
- `components/osv-header/osv-header.js`: `export const VERSION = 'X.Y.Z'` (header badge renders `v${VERSION}` from it)
- `sw.js`: `CACHE_VERSION = 'osviewer-X.Y.Z'` (else returning users keep the old cached shell)

Adding a file under `app/`/`components/` → also add it to `sw.js` SHELL and
`@import` its CSS in `index.css`. `package.json`'s `version` is unrelated — leave it.

Push to `master` auto-deploys (~1 min); verify the header badge afterwards.

## Layout

- `index.html` — shell: UMD script tags, pre-paint theme script, file:// guard, component tags.
- `index.js` — bootstrap: imports every component (registers it), starts store, wires folder switch, registers SW.
- `index.css` — @imports styles/ then each component CSS.
- `imports.js` — the only module that touches libraries; all code imports from here.
- `app/` — logic: state.js (signals) · store.js (folders/IndexedDB/FS/scan) · model.js (pure helpers) · render.js · diff.js · annotations.js (review) · review-guide.js · search.js · prompt.js · testbridge.js (e2e API on window).
- `components/osv-<name>/` — header, folder-rail, search, file-list, pane, review, loading, toast; each own .js + .css.
- `lib/` — vendored: html-literal.js + tiny-signals.js (ESM) · marked/js-yaml/purify/fuse (UMD, window globals).
- `styles/` — reset.css · variables.css (theme tokens) · global.css.

## Rules

- No build, no npm except `npm test`. Must serve over http(s): ES modules + SW fail on file:// (index.html shows a "needs a web server" page).
- Markup only via `html` (html-literal encodes interpolations → XSS-safe); `htmlRaw` only on DOMPurify output. Never raw innerHTML string concat.
- State via tiny-signals: signal / computed(fn, deps) / effect (returns dispose). Patch DOM in place; don't rebuild subtrees (loses selection/scroll/focus).
- Components: `osv-` prefix, registered by import from index.js, fixed DOM once in connectedCallback, updates in place.
- Import libraries only from imports.js. No shadow DOM unless isolation is needed; theme via CSS custom properties (variables.css).
- SW: navigations network-first (fresh shell on reload), other assets cache-first → tick "Bypass for network" in DevTools when editing assets.
- Live monitoring polls every 10s; changed files get a green "new" marker, group counter, toast.
- Folder-picker fallback: hidden `#picker` webkitdirectory input in osv-folder-rail (upload mode: session-only, no live dot).

## Dev

- Serve: `python -m http.server 8743` (start.sh / start.bat serve + open browser).
- Unit: `npm test` → node --test tools/test-*.mjs (model, diff, search).
- E2E: root `*-test.js` — diff, migration, multi-folder, collapse, archive-read, whole-file-comment, review-guidance. Stub showDirectoryPicker with an in-memory tree; drive the real pipeline via app/testbridge.js. Run: serve on 8743, then `playwright-cli open http://127.0.0.1:8743/index.html` and `playwright-cli run-code --filename=<test>.js`.
- The real folder picker (showDirectoryPicker) cannot be automated headless (promise hangs) → use the upload fallback: `setInputFiles('#picker', folder)`.

## screenshot.png

Live deployed app, data = local working tree read at upload time (session-only: no live dot; badge shows the deployed version). Re-shoot only when UI changes. Scratch playwright-cli script: clear SW/caches → reload ignoring cache → viewport 1440×900 → setInputFiles on #picker to the repo folder → wait for rail + file list → open a change's Proposal tab → full-page save. Delete the script + `.playwright-cli/` junk after.

## References

- plainvanillaweb.com (components, styling, sites, applications)
- github.com/jsebrech: html-literal, tiny-signals
- web.dev/baseline + Interop (feature availability)