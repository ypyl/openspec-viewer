## 1. Drawer component and DOM shell

- [x] 1.1 Create `components/osv-nav-drawer/osv-nav-drawer.js`: a light-DOM component whose `connectedCallback` (guarded with the `_init` pattern used by sibling components) wraps its existing children — the not-yet-upgraded `<osv-folder-rail>` and `<osv-file-list>` elements — inside a `.nav-panel` div, and appends a `.nav-backdrop` div plus a panel title row with a close button. It imports `navDrawerOpen` from `app/state.js`, toggles the `open` class and a body scroll-lock class from the signal via `effect`, closes the drawer on Escape, backdrop click, close button, and the document `osv:select-rel` / `osv:select-change` events; on open it focuses the close button, and on an Escape-close it returns focus to the header `.nav-toggle`.
- [x] 1.2 Create `components/osv-nav-drawer/osv-nav-drawer.css`: at ≥62em the element is `display: contents` so the rail and sidebar stay `.layout` flex items exactly as today; below 62em it becomes a fixed full-viewport layer — translucent `.nav-backdrop` plus a `.nav-panel` at `width: min(86vw, 360px)` that slides in/out via transform and is `visibility: hidden` (out of layout and tab order) when closed; panel-scoped adaptations keep the rail as its horizontal avatar strip on top and let the sidebar fill the remaining panel height (`max-height: none`, its own scroll).
- [x] 1.3 Update `index.html`: wrap `<osv-folder-rail>` and `<osv-file-list>` inside a new `<osv-nav-drawer>` element within `.layout` (same order, everything else untouched).
- [x] 1.4 Register the new component: import `./components/osv-nav-drawer/osv-nav-drawer.js` in `index.js`, `@import` the CSS in `index.css`, and add both files to `sw.js` SHELL.

## 2. State, header toggle, and auto-close

- [x] 2.1 Add `navDrawerOpen = signal(false)` to `app/state.js` — in-memory only, no persistence, always starts closed.
- [x] 2.2 Add a `.nav-toggle` hamburger button (☰) to `osv-header` markup before the title, a click handler that flips `navDrawerOpen`, and `aria-expanded`/`aria-label` synced from the signal via the existing effect pattern; CSS shows the button only below 62em.
- [x] 2.3 Set `navDrawerOpen.value = false` inside `activateFolder()` in `app/store.js` so every folder activation (rail avatar click, folder picker, same-folder re-pick, restore on reload) dismisses the drawer.

## 3. Version bump (same commit as the UI work)

- [x] 3.1 Bump all three version markers to v3.6.0 in the SAME commit as the UI changes: `index.html` first-line comment (`<!-- OpenSpec Local Viewer v3.6.0 -->`), `components/osv-header/osv-header.js` `VERSION = '3.6.0'`, and `sw.js` `CACHE_VERSION` (`osviewer-3.6.0`).

## 4. Verification

- [x] 4.1 Run `npm test` — the unit suite (model/diff/search) must stay green; no unit-level behavior changed.
- [x] 4.2 Serve `python -m http.server 8743` and run the existing e2e suite at the default desktop viewport (≥62em) via playwright-cli: `diff-test.js`, `migration-test.js`, `collapse-test.js`, and `whole-file-comment-test.js` — the desktop layout is unchanged, so direct sidebar clicks must keep passing.
- [x] 4.3 Write and run `mobile-drawer-test.js` at a narrow viewport (<62em): upload a folder via `#picker`; assert the rail and sidebar are hidden and the pane spans the width; open the drawer via the header toggle; assert the rail avatars and sidebar list are visible inside the drawer; pick a file → the drawer closes and the artifact shows in the pane; reopen → the same selection/scroll state is preserved; Escape, backdrop click, and the close button each close the drawer; at ≥62em assert no toggle exists and the panels render as columns side by side.
- [x] 4.4 Commit everything (UI work and version bump together), push to `master`, wait for the GitHub Pages build (~1 min), and confirm the header badge reads v3.6.0 at https://ypyl.github.io/openspec-viewer/.
- [x] 4.5 Confirm `screenshot.png` needs no re-shoot: at 1440×900 the desktop layout is visually identical to before this change (rail and sidebar remain pinned columns; the drawer and its toggle never render at that width).