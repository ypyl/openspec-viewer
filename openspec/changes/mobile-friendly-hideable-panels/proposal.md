## Why

The app is desktop-first on phones: the folder rail and the file list sidebar are laid out as panels that stay on screen and compete with the artifact pane, so on a narrow screen the artifact content ends up cramped or pushed off. Today the only adaptation is the rail collapsing to a horizontal strip and the sidebar losing its fixed width — the panels are never hidden. Hiding both panels behind a slide-over drawer gives the pane full width while browsing on a phone.

## What Changes

- Add a slide-over navigation drawer on narrow screens (<62em) that holds the folder rail and the file list sidebar; both panels are hidden by default behind the drawer.
- Add a hamburger/menu toggle in the app header (mobile only) that opens and closes the drawer; the drawer also closes via Escape, a backdrop click, and a close button inside it.
- Choosing a folder avatar or a file/change row from the drawer closes the drawer and lands the selection in the content pane.
- Keep the desktop layout at ≥62em exactly as it is today — the rail and sidebar remain pinned columns; the toggle is hidden.
- Keep the review panel's narrow-screen behavior (full-width section below the content) unchanged.
- **Version bump to v3.6.0 (MINOR)** in the same commit across the three markers (index.html first-line comment, header badge `VERSION`, `sw.js` `CACHE_VERSION`).
- No `screenshot.png` re-shoot: the desktop viewport (1440×900) visuals do not change.

## Capabilities

### New Capabilities
- `mobile-navigation`: slide-over navigation drawer on narrow screens that hides the folder rail and artifact list behind a header toggle and returns the full pane width to the content; auto-closes when the user picks a folder, a file, or a change.

### Modified Capabilities
- `project-switcher`: on narrow screens the folder rail is presented inside the navigation drawer (hidden by default); selecting a folder from the drawer closes it.
- `file-list`: on narrow screens the artifact list is presented inside the navigation drawer; selecting an artifact or change closes the drawer and reveals the artifact in the pane.

## Impact

- `index.html` — wrap `<osv-folder-rail>` and `<osv-file-list>` in a new `<osv-nav-drawer>` element inside `.layout` (the elements stay in the DOM permanently; no subtree rebuilds).
- New component `components/osv-nav-drawer/` (osv-nav-drawer.js + osv-nav-drawer.css): fixed slide-over panel, backdrop, close button; registered by index.js; CSS `@import`ed in index.css; JS added to `sw.js` SHELL.
- `app/state.js` — new `navDrawerOpen` tiny-signal.
- `components/osv-header/` — hamburger/menu toggle button, hidden at ≥62em; `aria-expanded` synced to the signal.
- `components/osv-folder-rail/` — avatar clicks dispatch `osv:select-folder` (after `activateFolder`) so the drawer closes on folder selection; the existing `osv:select-rel` / `osv:select-change` events already fire for file/change picks.
- `app/store.js` — `activateFolder()` closes the drawer so non-click activations (restore on reload, upload, pick) also dismiss it.
- Version markers → **v3.6.0**: `index.html` first-line comment, `components/osv-header/osv-header.js` `VERSION`, `sw.js` `CACHE_VERSION`.
- No dependency, serving, or install changes (app-delivery untouched).