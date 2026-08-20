## Context

See proposal.md — Why. The comment popup (`ann-bubble` in `app/annotations.js`)
is a `position: fixed` element positioned relative to the viewport. There are
two call sites that place it, and both hard-code a "below the anchor"
placement:

- `showAnnBubble()`: `bub.style.top = rect.bottom + 8`
- `repositionBubble()` (pane scroll): same `rect.bottom + 8`

The horizontal axis has a clamp (`Math.max(8, Math.min(rect.left, innerWidth - 990))`),
but the vertical axis has none, so near the bottom of the viewport the bubble is
placed off-screen. The bubble's own height is not measured anywhere today.

Because the bubble is `position: fixed`, `range.getBoundingClientRect()` and
`innerWidth` / `innerHeight` are already in the same (viewport) coordinate
space — no scroll-container offset math is needed.

## Goals / Non-Goals

**Goals:**
- Keep the comment popup fully within the viewport at all times, both on first
  show and on scroll-driven reposition.
- Flip the popup above the anchor when there is not enough room below.
- Reuse the exact same geometry logic across the show and reposition paths so
  behavior stays consistent.
- Preserve the existing Comment → textarea → Save flow and dismiss behavior.

**Non-Goals:**
- No change to the bubble's content, styling, or the highlight/comment flow.
- No change to any other popup (e.g. the review or prompt modal).
- No new layout or data-model changes.

## Decisions

- **Single shared placement helper.** Extract `positionBubble(bub, range)` used
  when the bubble is shown and when it expands to the textarea editor.
  Rationale: keeps placement consistent and lets the taller editor state
  recompute the flip. Alternative considered: patch each call site inline —
  rejected as it duplicates logic and risks divergence.
- **Measure the real bubble height with `offsetHeight`** after appending, then
  choose below/above. The bubble is small in its initial "Comment" state but
  grows when the textarea opens; a constant estimate would misjudge the flip on
  scroll. Because the element is `position: fixed`, appending it does not affect
  document flow, so measuring height causes no visible layout jump.
- **Flip threshold:** place below when `rect.bottom + GAP + height <= innerHeight`,
  otherwise place above at `max(GAP, rect.top - height - GAP)` (GAP = 8px,
  matching today's spacing). Rationale: simplest correct rule that satisfies the
  "prefer below, flip above" requirement.
- **Close on scroll rather than reposition.** The bubble does not follow the
  selection while the pane scrolls — a repositioned fixed popup is visually
  unstable and can jump/land off-screen (e.g. to the top-left) once the anchor
  leaves the viewport. Instead the scroll handler dismisses the popup. This is
  simpler and avoids the off-screen-anchor pathology.
- **Recompute position when the editor expands.** The popup's initial "Comment"
  button is short; swapping in the textarea + Cancel/Save grows it. After the
  expansion it is re-positioned against the new height so the actions stay in
  view (flipping above the anchor near the bottom).
- **Clamp both axes using the measured size** instead of the hard-coded `990`.
  `left = clamp(rect.left, GAP, innerWidth - width - GAP)` and the vertical
  result is itself clamped with `max(GAP, …)`. Replacing the magic number
  removes a latent overflow bug on the right edge too.
- Viewport-relative math throughout (`getBoundingClientRect` + `innerWidth` /
  `innerHeight`), since the bubble is fixed. Alternative — computing against the
  pane's scroll container — rejected; it is more complex and unnecessary.

## Risks / Trade-offs

- [Bubble height measured after append could differ from its rendered height if
  the popup had images/fonts yet to load] → Content is text/buttons only; height
  is stable immediately after render, and it is re-measured when the editor
  expands.
- [Flip could cause a brief re-layout when near the boundary] → The element is
  `position: fixed` and appended before final placement, so no reflow of the
  page; the bubble is simply placed at its final top on the first paint.
- [Removing the `990` constant could, in rare cases, change where the bubble
  sits on very wide screens] → Measured clamping is strictly more correct than
  the constant; any change is an improvement, and centered selection anchors
  are unaffected.
