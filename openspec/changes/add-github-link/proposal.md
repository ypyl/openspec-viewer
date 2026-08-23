## Why

The app is distributed and open-sourced from `https://github.com/ypyl/openspec-viewer`, but the running page gives no way to reach the project's home — users who discover the hosted app have to guess or search for its source. A small, always-visible link in the app's chrome fixes that in one gesture.

## What Changes

- **GitHub link in the folder rail (left bottom corner).** A link button pinned to the bottom of the left folder rail (and to the end of the rail's horizontal strip on narrow screens), styled exactly like the existing add-folder button (＋): same 40×40 rounded square, dashed border, transparent background, and hover treatment. Inside it sits the GitHub mark icon instead of the ＋ glyph.
- **Targets the project repo.** The link opens `https://github.com/ypyl/openspec-viewer` in a new tab (`target="_blank"` + `rel="noopener"`). The button carries the non-visible label "OpenSpec Viewer on GitHub" (tooltip + `aria-label`).
- **Part of the rail's static chrome.** The link is rendered once with the rail (not via the reactive avatar list), so it never moves or re-renders while folders come and go, and never competes with avatar clicks, unread dots, or the add action.
- **No behavioral change anywhere else.** No serving/install changes, no new dependencies, no changes to monitoring, file list, search, or review. The app stays offline-capable; the icon is inlined as SVG.

## Capabilities

### New Capabilities

- `app-chrome`: App-level UI furniture that is not tied to a feature area — the global GitHub link button in the folder rail. New so this change's behavior has a home without forcing it into `project-switcher` (folder switching) or `app-delivery` (serving/loading); future global chrome can be added here.

### Modified Capabilities

- none

## Impact

- **New code**: none (no new modules; the link is static markup + one icon).
- **Changed components**: `components/osv-folder-rail` — add the link button to the rail's static markup and give it the rail-add button's shape in CSS.
- **No new dependencies, no build step, no serving/install changes** — the app-delivery capability is unaffected.
- **Version**: MINOR bump (new visible feature) across the three markers (index.html comment, header badge, sw.js CACHE_VERSION).