## Why

The app is desktop-first: at ≥62em the folder rail, sidebar, pane, and review panel are all pinned columns, and the fixed chrome (rail 60px + sidebar 280–340px + review 380px) leaves a 992–1400px "dead zone" where the content pane gets only ~270–590px of width. There is no way to drop a panel, so reading and reviewing on a small laptop window is cramped. Mobile already auto-hides both sides (nav drawer + review hidden below 62em); this change gives the user manual control on desktop.

## What Changes

- Add header toggle buttons (≥62em only, aligned with the existing `☰` nav-toggle pattern) to hide/show the **review panel** (right) and the **file list sidebar** (left). The folder rail stays pinned. Hidden by default: neither panel is hidden until the user hides it.
- When the review panel is hidden, show a floating **restore pill** (💬 + count when comments exist) that brings the panel back. The panel is never dismantled while hidden — adding comments, deleting them, and copying the prompt all remain possible (in the restored panel); no review action is stranded.
- While the sidebar is hidden, navigation stays possible through the existing header content search, which deep-links into any artifact; the pane-bar diff badge still shows the open file's state.
- The hidden state persists across reloads (localStorage, same pattern as the theme preference), and is scoped to ≥62em: below 62em the mobile auto behavior (nav drawer, review hidden) stays unconditional and unchanged.
- Reflow is pure CSS: hiding a panel removes it from the flex layout and the pane (flex:1) re-expands to fill the space; no DOM moves, no subtree rebuilds.
- **Version bump to v3.8.0 (MINOR)** in the same commit across the three markers (index.html first-line comment, header badge `VERSION`, `sw.js` `CACHE_VERSION`).
- No `screenshot.png` re-shoot: the default 1440×900 viewport visuals are unchanged until a user hides a panel.

## Capabilities

### New Capabilities
- `panel-visibility`: user-controlled show/hide of the review panel and file list sidebar at viewport widths of 62em or more — header toggles, the review restore pill, persistence of the hidden states, and the ≥62em scoping that keeps narrow-screen auto behavior untouched.

### Modified Capabilities
- `review`: replace the existing requirement that the header "SHALL NOT provide a review control" and that the panel is "always in the layout" at ≥62em — the panel becomes hideable/showable at ≥62em, with the review workflow (add comment, delete comment, copy prompt) preserved while hidden; narrow-screen hiding below 62em is unchanged.

## Impact

- `app/state.js` — new `reviewHidden` and `sidebarHidden` tiny-signals, hydrated from `localStorage` at boot and persisted on change (alongside the existing theme-preference pattern).
- `components/osv-header/` — two toggle buttons (visible ≥62em only), `aria-pressed` synced to the signals via the existing signal/effect pattern.
- `components/osv-review/` — floating restore pill rendered when the panel is hidden (reuses the same item count the Copy prompt label uses); the drawer element stays in the DOM, hidden via CSS, so its existing list/delete/copy behavior is untouched.
- `components/osv-file-list/` + layout — CSS-only hide at ≥62em; the pane reflows via its existing `flex: 1`. No new component files, so `sw.js` SHELL and `index.css` @imports are unchanged; only the version markers bump.
- New e2e `panel-toggle-test.js` at a narrow desktop viewport (≥62em) asserting: hiding the review panel widens the pane, the pill appears with the right count, restore keeps add/delete/copy working, the sidebar toggle hides/shows, and both states survive a reload; existing e2e at the default desktop viewport must stay green.
- App delivery unchanged (serving, SW, install); no dependencies added.