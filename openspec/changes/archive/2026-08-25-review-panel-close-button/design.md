## Context

See proposal.md — Why. v3.8.0 gave the review panel and the file list sidebar two header toggle buttons (`.toggle-review`, `.toggle-sidebar`) driving `reviewHidden` / `sidebarHidden` signals; hiding either drops it from the ≥62em flex layout via `body.hide-*` classes, and the review panel's hidden state shows a floating 💬 restore pill. This change moves the review hide affordance from the header onto the panel itself, keeping every mechanism (signal, body class, CSS reflow, persistence, pill restore) as-is.

## Goals / Non-Goals

**Goals:**
- The review panel can be hidden from a close control on the panel itself; the header has no review toggle anymore.
- Restore stays exactly as shipped: the pill appears whenever the panel is hidden, click reopens the drawer with list/delete/copy intact.
- The sidebar keeps its header toggle; persistence, reflow, and narrow-screen behavior are untouched.

**Non-Goals:**
- No change to the sidebar toggle, the pill, the hidden-state CSS, or `osviewer.panels` persistence.
- No new header control to replace the removed one (the pill is the review's only restore path).
- No mobile behavior change (the panel — and thus its close control — is hidden below 62em).

## Decisions

### 1. The close control is a right-aligned ✕ row inside the review drawer, without a title

`.review-drawer` gains a slim `.review-head` row at the top holding a single ✕ button (aria-label/title "Close review panel"), right-aligned. The ✕ sets `reviewHidden.value = true` — the same signal the removed header toggle flipped, so the body class, CSS reflow, and persistence behave identically. Placement in the panel follows how `osv-nav-drawer` dismisses itself with its own close button.
- *Alternative considered:* a title row with a "Review" label mirroring the nav drawer. **Rejected at apply time** — review-guidance-test guards a deliberate v2.4 decision that the panel carries no redundant Review heading (the Copy prompt button's label carries the count); adding a title would have reverted that tested constraint (and required a spec delta to justify it). The spec's close-control requirement mentions no title, so the label was dropped and the guard was narrowed to its original intent (no heading text, `.review-title` / `.review-head-title`), while `.review-head` itself now legitimately holds the close affordance.
- *Alternative considered:* putting ✕ next to the Copy prompt in `.review-actions`. Rejected: that row is the review's terminal action surface, and dismissal belongs up top where the panel starts.

### 2. Remove the header review toggle entirely, keep the sidebar toggle

`osv-header` deletes `.toggle-review` (markup, click handler, aria-pressed effect) and its CSS; `.toggle-sidebar` and its effect stay untouched. The header keeps the ☰ nav toggle, theme, search, stats, and sidebar toggle. No other component reads the removed button. The review's visible/hidden state stops being reflected anywhere in the header — the panel's presence (visible) or the pill (hidden) is the state indicator, per the spec deltas.

### 3. Focus continuity on close

Clicking ✕ hides the panel and focuses the restore pill (which appears as a consequence), so keyboard users land on the natural next control instead of losing focus to `<body>`. The pill is a real button, so `focus()` works; on mobile the pill is hidden, but the panel (and ✕) is hidden there too, so the focus call is a no-op in practice.

### 4. No changes to the hidden-state machinery

The close button is a pure input to the existing `reviewHidden` signal. No CSS changes for hiding, no persistence changes, no changes to the pill or its count derivation (`review.value.items.length`), no layout changes. The only CSS added is the `.review-head` row styling, scoped so it disappears with the panel below 62em.

## Risks / Trade-offs

- [A user misses the header affordance they learned in v3.8.0] → The ✕ is a standard, discoverable dismissal symbol on the panel itself; the restore pill is unchanged and always present while hidden.
- [The "Review" label row takes vertical space from the list/checklist] → It is a slim single row (~32px), flex-shrink:0, matching the panel's existing spacing; the checklist/list already scroll independently.
- [e2e that references the header review toggle breaks] → `panel-toggle-test.js` is updated in this change to drive the panel close button and assert no header review toggle; the rest of the suite (whole-file-comment, mobile-drawer, review-guidance, …) never touches `.toggle-review`.
- [screenshot.png becomes stale] → The header loses one button and the panel gains a title row; re-shoot at 1440×900 as part of this change (AGENTS.md: re-shoot when UI changes).

## Migration Plan

Deploy is the standard push-to-master → GitHub Pages flow; the v3.9.0 version bump rides the same commit. Rollback is a git revert. No data migration: `osviewer.panels` semantics are unchanged; nobody stores the removed header button's state.

## Open Questions

None — close placement (title row), removal scope (review only, sidebar toggle kept), restore path (pill only), and focus handling were settled above and match the spec deltas.