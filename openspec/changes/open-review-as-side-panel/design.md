# Design: open review panel as a side panel

## Context

See proposal.md (Why). Current state: `<osv-review>` is a sibling of `.layout`; its `.review-drawer` is `position: fixed; top/right/bottom: 0; width: 360px`, revealed by toggling an `open` class (translateX off-canvas → none) at `z-index: 55`, with a drop shadow and left border. Open/close is driven entirely by a class toggle via events (`osv:toggle-review`, `osv:open-review`, `osv:focus-review`, `osv:review-visibility`). The body is an app shell (`height: 100%`, flex column); `.layout` is `flex: 1` and, at ≥62em, a row containing `osv-file-list` (280–340px) and `osv-pane` (`flex: 1; min-width: 0` with internally scrolling `<main>`). The pane pins+centers content to a max width (980px, 1080px at ≥88em).

## Goals / Non-Goals

**Goals**
- Make the review a real right-hand column of `.layout` so the pane shrinks instead of being covered.
- Keep the change small and JS-free at the feature boundary by keying CSS off the existing `open` class.
- Keep the app-shell (inner-scroll) model; no document-flow rewrite.

**Non-Goals**
- Not changing the overall scroll model to natural page scrolling (document-flow/sticky sidebar).
- No resize handle / draggable panel width.
- No change to review content, ordering, actions, or prompt generation.
- No escape-to-close behaviour (out of scope; there is none today and we are not adding it).

## Decisions

### D1: Move `<osv-review>` into `.layout` and make the host element the column

Move the element from a sibling of `.layout` into it as a third flex child. Because `.layout` is already `flex-direction: row` at ≥62em, adding a child makes a three-column row: file list | pane | review. The host `osv-review` becomes the layout column; the inner `.review-drawer` fills it (`position: static; height: 100%`).

- *Alternative considered:* keeping `<osv-review>` where it is and using grid/fixed right column. Rejected: it would not let the pane participate in the same flex row, and the "pane shrinks" ask is exactly what a shared flex row gives for free.
- `osv-pane` already has `flex: 1; min-width: 0`, so it reflows automatically as the review column's width changes.

### D2: Animate width via `:has()` on the host, zero-width when closed

With the drawer carrying the `open` class:

```css
osv-review { width: 0; overflow: hidden; transition: width .22s ease; }
osv-review:has(.review-drawer.open) { width: 380px; }
```

and restyle the drawer for in-place layout:

```css
osv-review .review-drawer {
  position: static; width: 100%; height: 100%;
  border-left: 1px solid var(--border);  /* replaces the drop shadow */
  box-shadow: none; transform: none;
  /* keep display:flex; flex-direction:column; list overflow scrolls internally */
}
```

The `:has()` selector means **no JS changes**: the existing `open` class, the event protocol, the header button state, and `osv:review-visibility` all keep working. `overflow: hidden` clips the drawer while the width animates.

- *Alternatives considered:* a `data-open` attribute on the host or a signal; both add JS churn. `:has()` is already used in the codebase (AGENTS: `:has()` is an approved modern-CSS feature) and avoids it.
- The reflow is the intended behavior ("pane shrinks"), so animating `width` directly is correct here — unlike the old transform-based slide which hid content.

### D3: Narrow-screen fallback below a dedicated breakpoint (~80em / 1280px)

Below the point where three columns fit, keep the existing overlay treatment (fixed full-height drawer) so the pane stays usable, per spec "Usable on narrow screens".

```css
@media (min-width: 80em) {
  osv-review { width: 0; overflow: hidden; transition: width .22s ease; }
  osv-review:has(.review-drawer.open) { width: 380px; }
  osv-review .review-drawer { position: static; ... border-left: ...; }
}
```

The base (mobile-first) rules keep the current `position: fixed` overlay, so today's drawer behavior is preserved below the breakpoint with zero fallback risk. The threshold: the app already goes two-column at 62em and widens the sidebar at 75em; 80em (~1280px) is the first width where 280–340px list + viable pane + 380px review coexist comfortably.

- *Alternative considered:* aligning to the existing 62em/75em steps. Rejected: at 62em the three columns would leave the pane too narrow; a dedicated threshold is cleaner and easier to tune.

### D4: No resize handle, full collapse when closed

Closed = 0 width (pane returns to full width). No drag-to-resize. This matches the stated "collapse column fully to 0 width" decision and keeps the diff minimal.

- *Alternative considered:* a slim always-visible 💬 rail when closed. Deferred — noted as a possible future nicety, not part of this change.

## Risks / Trade-offs

- **Auto-open reflow flash** — the panel auto-opens on the first highlight (`annotations.js`), so the pane suddenly squeezes while the user is mid-selection. → The 220ms width transition absorbs most of it; acceptable.
- **Content-cap masking** — the pane centers content up to a max width, so on very wide monitors the visible "shrink" is small until width drops below the cap. → Expected; the reflow still happens below the cap and on typical laptop widths.
- **Two CSS personas for one DOM** — the drawer is an overlay below 80em and an in-place column above. → Contained to `osv-review.css` scoped by the media query; both are already-written, low-risk blocks.
- **`:has()` support** — requires evergreen browsers. → The codebase already relies on `:has()` elsewhere (AGENTS lists it as an approved feature); acceptable.

## Migration Plan

Pure CSS + one markup move; no data migration, no schema change. Rollback is a one-line revert of `index.html` and `osv-review.css`. Deploys on push to master via GitHub Pages; bump to v2.4.0 in the same commit (index.html comment, header badge, `sw.js` `CACHE_VERSION`).

## Open Questions

- None that change specs, approach, or tasks. (Tuning the exact breakpoint and panel width, and whether a future rail/resize is wanted, are post-ship refinements.)
