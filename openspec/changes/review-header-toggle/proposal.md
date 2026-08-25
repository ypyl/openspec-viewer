## Why

The v3.10.0 unification gave the left panel a single corner control (the ☰ toggle). The right panel still has two affordances — the in-panel ✕ (v3.9.0) and the floating restore pill with its count (v3.8.0) — which is asymmetric and redundant. The review panel should be controlled the same way as the left panel: one tidy toggle in the header corner, styled identically, that opens and closes it. The in-panel close button and the restore pill are both removed.

## What Changes

- Add a header button in the top-right corner (styled exactly like the ☰ corner toggle: same 30×30 bordered square) that opens and closes the review panel at ≥62em; its pressed state reflects the panel's hidden state, and it is hidden below 62em where the review panel is auto-hidden.
- Remove the in-panel close control (`.review-close` and its `.review-head` row) from the review panel.
- Remove the floating restore pill (markup, count sync, focus-on-close logic, CSS).
- The hidden state itself is unchanged: same `reviewHidden` signal, `body.hide-review` class, CSS reflow, and `osviewer.panels` persistence.
- With the pill gone, the panel's comment count is only visible while the panel is shown (the Copy prompt button's label); the header toggle is the sole reveal affordance, mirroring the sidebar.
- **Version bump to v3.11.0 (MINOR)** in the same commit across the three markers (index.html first-line comment, header badge `VERSION`, `sw.js` `CACHE_VERSION`).
- `screenshot.png` re-shoot required: the header gains a right-corner toggle and the panel loses its head row.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `panel-visibility`: the review panel gains a header visibility control (top-right, same style as the sidebar's ☰ toggle) and loses both the in-panel close control and the restore control; "Review panel provides its own close control" and "Hidden review panel shows a restore control with its count" are removed; "Header controls hide and show side panels" and "Panel visibility choice persists" are updated (no restore control anywhere).
- `review`: "Existing review behavior preserved" changes — the panel is hidden and shown through the header visibility control (not a panel close control or restore control).

## Impact

- `osv-header` — add a `.toggle-review` button in the top-right `.side` cluster (before the stats), styled as a corner toggle identical to `.nav-toggle`; click flips `reviewHidden`; an effect syncs `aria-pressed`/label; CSS hides it below 62em.
- `osv-review` — remove the `.review-head` row and `.review-close` button (markup, wiring, focus-on-close), and remove the `.review-pill` restore control (markup, `syncPill` effects, focus handler, CSS).
- `app/state.js` — unchanged (signals, persistence, body classes stay exactly as-is).
- Spec deltas: `specs/panel-visibility/spec.md` (MODIFIED ×2, REMOVED ×2) and `specs/review/spec.md` (MODIFIED ×1).
- e2e: `panel-toggle-test.js` drops the pill assertions and drives the header review toggle; `review-guidance-test.js` can restore its original "no panel header element" guards (the head row is gone); `mobile-drawer-test.js` unchanged behaviorally (pill absent below 62em regardless).
- Version markers → **v3.11.0**; `screenshot.png` re-shoot; no serving/install/dependency changes.