## Why

Reading a change means reading several artifacts in order: proposal, then spec deltas, then design, then tasks. A long artifact leaves its tab bar far above the reader, so finishing one document and starting the next costs a scroll back to the top before the tab can be clicked. That repeated scroll-up is the main friction in a linear read of a change.

## What Changes

- Add an in-flow navigation row at the end of an open change's artifact content, holding a Previous control and a Next control.
- Each control names the adjacent artifact by its tab label (for example `Previous: Spec` and `Next: Design`), so the destination is clear before clicking.
- The controls move between the open change's artifact tabs in tab-bar order. A control is disabled when no adjacent artifact exists: the first tab has no Previous, the last tab has no Next. There is no wraparound.
- The row appears only for a change view that has artifact tabs, including archived changes. Standalone artifacts (main specs and config files) have no tabs and therefore no row.
- Moving with the row is equivalent to selecting that tab: the target artifact opens scrolled to its top, and read/unread acknowledgment follows the existing change-monitoring rules unchanged.
- No breaking changes. Version: new visible feature → **MINOR, v3.18.0**, bumped in the same commit across the three markers.

## Capabilities

### New Capabilities

- `artifact-navigation`: the artifact tab bar of an open change, the order of its tabs, and moving between those tabs from a footer at the end of the artifact content.

### Modified Capabilities

_(none)_

## Impact

- `components/osv-pane/osv-pane.js` — render the footer after `.pane-body` in `openChange`, handle its clicks in the delegated handler already attached to `main`, and refresh its labels and disabled states in `activateTab`.
- `components/osv-pane/osv-pane.css` — styling for the footer row and its controls.
- Reuses `currentTabs` and `activateTab(i)`. No new state, no signal changes, and no `paneCache` change (the footer is a sibling of `.pane-body`, not part of the cached content).
- `tab-nav-test.js` — new end-to-end test following the existing root-level Playwright pattern.
- Version markers → **v3.18.0** in one commit: the `index.html` first-line comment, the header badge, and `sw.js` `CACHE_VERSION`.
- No serving, install, or dependency changes. `screenshot.png` needs a re-shoot because the pane gains a visible control.
