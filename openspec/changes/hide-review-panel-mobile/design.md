## Context

See proposal.md — Why. Current state that shapes the approach:

- `osv-review` is always visible: a reserved right-hand column (`--review-w`) at ≥62em, and a full-width section below the content (`min-height: 28vh`) below 62em. The panel has no open/close toggle or header button — it is permanently in the layout.
- The mobile breakpoint is already established at 62em: `osv-nav-drawer` (and the folder rail, file list, header) use `(max-width: 61.99em)` / `(min-width: 62em)` pairs, styled in each component's own CSS file composed via `@import` in `index.css`.
- Review items (highlights + whole-file comments) are stored per folder independently of the panel (persisted; hydrated on folder switch), so hiding the panel loses no data.
- No new files are added, so `sw.js` needs no SHELL update — only the `CACHE_VERSION` marker bump.

## Goals / Non-Goals

**Goals:**
- Remove the review panel from the mobile (<62em) page entirely: no reserved space, no controls that reveal it, content pane spans the full width.
- Keep the desktop (≥62em) layout byte-for-byte unchanged.
- Keep the change small and boring: CSS only, no JS, no state changes.

**Non-Goals:**
- No mobile review affordance of any kind (per decision A — no drawer entry, no bottom sheet, no floating button).
- No change to the text-selection highlight/comment popup or the whole-file comment button in the content pane — those keep working on phones, and their items resurface in the panel at ≥62em.
- Not fixing unrelated stale review-spec references (see Risks).

## Decisions

### D1: Hide the panel with a CSS media query, nothing else

Add to `components/osv-review/osv-review.css`, alongside the existing breakpoint queries:

```css
/* Narrow screens (<62em): the review panel is hidden entirely; the content
   pane spans the full viewport width. */
@media (max-width: 61.99em) {
  osv-review { display: none; }
}
```

The 61.99em/62em ranges are mutually exclusive, so cascade order against the existing `@media (min-width: 62em) { osv-review { width: var(--review-w); ... } }` is irrelevant. `display: none` removes the element from the flex column, so `.layout` (mobile: `flex-direction: column`) leaves only the pane, which fills the viewport. No layout math, no re-render logic.

Why not the alternatives:
- **Move review into the nav drawer / a second drawer**: contradicts decision A (review features unavailable on phones) and adds drawer plumbing for a desktop-only feature.
- **Overlay bottom-sheet shown on demand**: still requires a trigger control and open/close state; A explicitly excludes that surface.
- **JS guard on `osv:focus-review` / popups**: unnecessary; see D2.

### D2: Leave annotation JS untouched

`osv-review.focus(id)` (grep: `osv:focus-review` handler) runs `scrollIntoView` on an element inside a `display: none` subtree, which is a no-op — highlights stay recorded (persisted per folder) without any crash or stray UI. The content-pane highlight/comment popup (`app/annotations.js`) and the pane's whole-file comment button keep working; the panel shows those items the next time the viewport is ≥62em. Disabling highlight creation on mobile would need extra JS for no functional gain and would block the documented "record now, review on desktop later" flow.

### D3: Version bump v3.6.0 → v3.7.0 in the same commit

MINOR (user-visible layout change; nothing dropped on desktop). Bump all three markers together: `index.html` first-line comment, `osv-header.js` `VERSION`, `sw.js` `CACHE_VERSION`. `package.json` version is unrelated — leave it.

### D4: Screenshot

No re-shoot: `screenshot.png` is taken at 1440×900 (desktop layout), which is unchanged by an under-62em-only rule.

## Risks / Trade-offs

- **Mobile users lose review access (list, checklist, Copy prompt)** → Accepted by design (decision A); both spec requirements are modified to state it. Items recorded on mobile persist and surface at ≥62em, so no data is stranded.
- **Stale review-spec references remain in unmodified requirements** (e.g. "Review items are scoped to the active folder" still mentions "the header's comment-count badge", which does not exist) → Out of scope; the modified "Existing review behavior preserved" requirement keeps its scenario names (archive requires it) but rewrites the header-button scenario to assert that no header review control exists, which matches the app.
- **A future narrow-screen rule could re-show the panel unintentionally** (cascade surprise if someone adds `display: flex` elsewhere) → The rule lives next to the other 62em-breakpoint queries in the component's own CSS; a regression would be caught by the mobile verification task.

## Migration Plan

No data migration — review items are already stored per folder and unaffected. Deploy: push to `master` (auto GitHub Pages deploy), verify the header badge reads v3.7.0. Rollback: revert the media query and the three version markers in one commit; no persistent state is touched by this change.

## Open Questions

None. The reachability decision (hide entirely, option A) was resolved with the user before planning; everything else follows from it.