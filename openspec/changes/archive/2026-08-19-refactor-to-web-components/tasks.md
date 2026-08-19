## 1. Foundation — structure, vendored libs, skeleton

- [x] 1.1 Create the directory layout: `styles/`, `lib/`, `app/`, `components/`, each component gets `components/osv-*/` folders; add `imports.js` entry
- [x] 1.2 Vendor PVW libraries into `lib/`: html-literal, tiny-signals, tiny-context as ESM (from the jsebrech repos), replacing the inlined `window.PV` script
- [x] 1.3 Vendor marked, js-yaml, DOMPurify prebuilt UMD builds into `lib/`; load them off `window` in `imports.js`; remove the three CDN `<script>` tags from `index.html`
- [x] 1.4 Split the inline CSS into `styles/reset.css`, `styles/variables.css` (existing dark/light tokens), `styles/global.css`; create root `index.css` that `@import`s them plus component styles
- [x] 1.5 Reduce `index.html` to a skeleton: head meta, pre-paint theme bootstrap (inline, unchanged), stylesheet link, `<script type="module" src="index.js">`, `<noscript>` warning, static shells for the seven components, `file://`-detection message per spec
- [x] 1.6 Create `index.js` bootstrap: central component registration, startup sequence (theme sync, auto-reopen) replacing the old bottom-of-file init block

## 2. App logic modules

- [x] 2.1 Extract `app/state.js` — export all signals (`theme`, `allFiles`, `currentRel`, `currentKey`, `search`, `collapsed`, `highlights`, `recentRels`, `changeMeta`, `diffViews`, `diffInfo`, `dirHandle`, review UI state…); components import it directly
- [x] 2.2 Extract `app/store.js` — IndexedDB helpers (open/upgrade v2, handle save/load, snapshot get/put/delete/clear), File System Access pick/scan, `derivePrefix`/`normPath`, 10s poll loop, `autoReopen`; wire the picker and file-input fallback events here
- [x] 2.3 Extract `app/diff.js` — line diff, hunk headers, diff view HTML builders (pure functions, no DOM)
- [x] 2.4 Extract `app/render.js` — markdown (marked + DOMPurify), YAML/frontmatter parsing, meta card, path/artifact helpers (`artifactOf`, `groupOf`, `changeOf`, `displayLabel`, …)
- [x] 2.5 Extract `app/annotations.js` — selection capture, range→text-node wrapping (`wrapTextNode`/`wrapHighlight`), highlight persistence (IndexedDB + signals), comment bubble, review list builder; expose a hook so components can invoke it after render
- [x] 2.6 Extract `app/prompt.js` — review prompt assembly (highlight collection → fix prompt), copy-to-clipboard and open-in-new-tab helpers

## 3. Components (leaf dependencies first)

- [x] 3.1 `osv-header` — title/version badge, theme button (cycle + system-color listener), stats strip, review button + count; patch-in-place updates via effects
- [x] 3.2 `osv-toast` and `osv-loading` — transient toast queue and loading overlay (small, stateless-ish)
- [x] 3.3 `osv-file-list` — pick button + hidden file input fallback, search box (+ `/` shortcut), group sections with collapse, per-item rows with group counters, "new"/diff markers, empty states; patch-in-place updates that preserve `scrollTop`; dispatches selection events
- [x] 3.4 `osv-pane` — change tabs (Proposal/Spec/Design/Tasks/Metadata), crumb + diff toggle, artifact body rendered into light DOM via `app/render.js`, diff view via `app/diff.js`; exposes an `onRendered` hook called after every render/update; dispatches tab/diff/annotation events; scroll preservation on non-structural updates
- [x] 3.5 `osv-review` — review drawer: comment list, delete action, count/file summary, copy-fix and send-to-LLM buttons (enabled/disabled by comment presence)
- [x] 3.6 `osv-prompt-modal` — prompt textarea modal, copy and open-in-new-tab actions, close on backdrop/Esc

## 4. Annotation contract and interaction cleanup

- [x] 4.1 Wire `annotations.js` to `osv-pane`'s `onRendered` hook so highlights/comment bubbles re-apply after each pane render; keep the pane in light DOM so `document.getSelection()` still traverses text nodes
- [x] 4.2 Dissolve the old `contentEl` click delegation: move tab, mark, diff-toggle, review-item, and bubble handlers into their owning components; dispatch `CustomEvent`s for cross-component actions
- [x] 4.3 Remove the old inlined PV lib script, dead code paths, and any remaining references to the single-file structure; verify no `document.getElementById` from the app list targets removed hooks

## 5. Service worker, version, docs

- [x] 5.1 Update `sw.js`: precache the full asset graph (HTML, manifest, icons, `index.js`, `imports.js`, all `app/*`, `components/*`, `lib/*`, `styles/*`), keep navigation network-first + assets cache-first
- [x] 5.2 Bump all version markers to 2.0.0 in the same commit: first-line HTML comment, header badge, `CACHE_VERSION` → `osviewer-2.0.0`
- [x] 5.3 Rewrite README.md: install story becomes "open the hosted app / install as PWA"; remove the single-file download and `file://` instructions; document the local dev server workflow (`python -m http.server 8743`)

## 6. Tests and verification

- [x] 6.1 Update `diff-test.js` for the new boot sequence and served module graph; re-run against `python -m http.server 8743` and confirm all steps pass
- [x] 6.2 Update `migration-test.js` (v1→v2 IndexedDB upgrade) for the new boot; confirm handle persistence and snapshot store checks still pass
- [x] 6.3 Manual regression pass: theme (incl. system sync), live monitoring + hot refresh, diff toggle and NEW badges, review highlight/comment/bubble flow, prompt copy + open-in-new-tab, sidebar collapse/search — verify scroll and focus survive list/pane updates
- [x] 6.4 Confirm the `file://` error message shows when the page is opened directly from disk and the app does not boot