## Why

The app is a 2,692-line single `index.html`: inline CSS, inlined vendored libs, CDN dependencies, and one 1,550-line script where rendering, data access, events, and annotations are interwoven. It works, but every new feature touches a growing pile of related code and re-renders whole DOM subtrees on each state change. The project's AGENTS.md already commits to the Plain Vanilla Web architecture (web components, ES modules, split CSS, signal-driven state with patch-in-place updates); the app has not caught up to it.

## What Changes

- Split the single `index.html` into a Plain Vanilla Web application: `index.html` (skeleton) + `index.js` bootstrap + `index.css` with `@import`s, `styles/`, `lib/`, `app/` logic modules, and per-component folders under `components/`.
- Convert the UI into web components (`osv-header`, `osv-file-list`, `osv-pane`, `osv-review`, `osv-prompt-modal`, `osv-loading`, `osv-toast`), registered centrally in the bootstrap.
- Switch from classic inline scripts to ES modules (`<script type="module">` + `imports.js`), served over HTTP(S).
- **BREAKING**: Drop `file://` support — the app now requires being served over HTTP(S) (ES modules and the service worker do not run from `file://`). Hosted GitHub Pages deployment and PWA install become the distribution paths; the "download one file and open it" story in the README is removed.
- **BREAKING**: Vendor marked, js-yaml, and DOMPurify into `lib/`; remove the three CDN `<script>` tags (no runtime CDN dependency).
- **BREAKING**: Version bumps to **2.0.0** (MAJOR: layout overhaul + dropped features). Version badge, first-line comment, and `sw.js` cache name stay in sync per the version-bump rule.
- Convert full-subtree `innerHTML` re-renders to patch-in-place updates in the stateful components (file list, pane) to preserve scroll position, focus, and selection.
- Introduce an explicit annotation contract: `osv-pane` renders into light DOM and calls an `onRendered` hook; the annotation module re-applies highlights after each render.
- Keep state in signals, but as an exported `app/state.js` module imported directly by components; tiny-context stays vendored but dormant (deliberate deviation, documented in design.md).
- Update `sw.js` to precache the full module graph; update `diff-test.js` and `migration-test.js` for the new boot sequence; update the README install/usage sections.

## Capabilities

### New Capabilities

- `app-delivery`: How the app is distributed and loaded at runtime — served over HTTP(S) only (no `file://`), hosted on GitHub Pages, installable as a PWA with offline support via the service worker, all dependencies vendored locally (no CDN), version badge and service-worker cache name kept in sync.

### Modified Capabilities

None — no existing specs in the repository.

## Impact

- `index.html` — shrinks to a static skeleton; all styles and behavior move out.
- New tree: `index.js`, `index.css`, `imports.js`, `styles/`, `lib/`, `app/`, `components/`.
- `sw.js` — SHELL list grows to the full asset graph; `CACHE_VERSION` becomes `osviewer-2.0.0`.
- `README.md` — Install section rewritten (hosted + PWA; no single-file download, no `file://`).
- Tests — `diff-test.js`, `migration-test.js` updated to match the new boot sequence.
- Runtime behavior — no CDN requests; app requires an HTTP(S) origin.