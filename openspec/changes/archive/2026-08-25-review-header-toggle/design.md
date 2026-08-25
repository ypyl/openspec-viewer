## Context

See proposal.md — Why. Panel visibility evolved in three steps: v3.8.0 added header toggles for both panels plus a floating restore pill for the review; v3.9.0 moved the review hide onto an in-panel ✕ (pill stayed as the restore); v3.10.0 unified the left panel onto the ☰ corner toggle and removed the top-right ▨. This change converges the review panel on the same corner-toggle model: a top-right header button (styled like the ☰) toggles it, and both the in-panel ✕ and the restore pill are removed. The hidden-state machinery (`reviewHidden` signal → `body.hide-review` class → ≥62em CSS reflow → `osviewer.panels` persistence) is untouched.

## Goals / Non-Goals

**Goals:**
- One visually-identical corner toggle per panel: ☰ (top-left) for the sidebar, a matching button (top-right) for the review panel; each opens and closes its panel and indicates state via `aria-pressed`.
- Remove the in-panel ✕ (and its `.review-head` row) and the floating restore pill entirely — no residual review-only affordances.
- Persistence and reflow stay byte-for-byte the same behavior.

**Non-Goals:**
- No change to the sidebar ☰ behavior (v3.10.0) or to `mobile-navigation`.
- No change to the review drawer's internals (list, delete, Copy prompt) or the hidden-state CSS.
- No pill-like indicator anywhere; the count is available on the Copy prompt label while the panel is shown (v2.4 no-heading constraint restored).

## Decisions

### 1. The review toggle is a corner button styled identically to the ☰

`osv-header`'s `.side` cluster (top-right, before the stats) gains a `.toggle-review` button sharing the exact `.nav-toggle` look: 30×30, `var(--bg)` fill, 1px `var(--border)`, radius, centered glyph. The CSS selector group is extended (`osv-header .nav-toggle, osv-header .toggle-review { ... }`) so the two corner controls can never drift apart, and the same `[aria-pressed="true"]` accent treatment marks the hidden state. `aria-pressed` + label/title ("Hide review panel"/"Show review panel") sync via the existing signal/effect pattern; the effect is `reviewHidden.effect(...)` mirroring the sidebar's. Hidden below 62em (`@media (max-width: 61.99em)`) because the review panel is auto-hidden there and a toggle would control nothing.

### 2. Remove the in-panel close and the restore pill together

`osv-review` loses:
- the `.review-head` row + `.review-close` button (markup, click handler, focus-on-close) — the v2.4 "no panel header elements" invariants guarded by `review-guidance-test` become valid again and the test can revert to its original assertions;
- the `.review-pill` restore control (markup, `syncPill` effects, focus handler, CSS).

No new component learns about the review hidden state outside `osv-header` — the single toggle is the only controller, matching how the sidebar is controlled.

### 3. Restore-path semantics collapse into the toggle

Previously "hidden → restore via pill or ✕; shown → hide via ✕". Now "activate the toggle" does both, exactly like the sidebar. Nothing else references the hidden state (no overlay, no count). The review spec's "Deletion and copy remain possible after restore" scenario keeps its name; 'restore' now means "shown again via the header toggle".

## Risks / Trade-offs

- [Losing the pill loses the count while hidden] → Accepted and spec'd: panel controls are symmetric now; the count is on the Copy prompt label when shown. The review-guidance no-heading constraint (count only on Copy prompt) pre-dates the pill anyway.
- [A top-right control next to stats crowds the header col3] → Col3 is 380px at ≥62em (stats + one 30px button); the button replaces the space the ▨ toggle occupied before v3.10.0.
- [Users who learned the in-panel ✕ or the pill (v3.9.x/v3.8.x) lose them] → The corner toggle is the standard hidden-until-visible pattern (same as the sidebar since v3.10.0); pressed state + tooltip communicate it.
- [e2e referencing the pill/✕ breaks] → `panel-toggle-test.js` is rewritten to drive the header toggle and assert no pill/✕; `review-guidance-test.js` reverts its head checks; the rest of the suite never touches these elements.

## Migration Plan

Deploy is the standard push-to-master → GitHub Pages flow; the v3.11.0 version bump rides the same commit. Rollback is a git revert. No data migration: `osviewer.panels` semantics are unchanged (the review hidden state still persists); removed UI (pill/✕) is gone but state lives on.

## Open Questions

None — pill removal (user chose full symmetry), toggle placement (top-right `.side` cluster), and the v2.4 heading-constraint restoration were settled above and match the spec deltas.