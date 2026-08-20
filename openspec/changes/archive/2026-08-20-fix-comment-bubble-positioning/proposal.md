## Why

The comment popup (the bubble that lets the user write a note on a selected
highlight) is always positioned *below* the selected text. When the selection
or comment anchor sits near the bottom of the viewport, the bubble is placed
off-screen and the user cannot see or use it to enter a comment. It should stay
within the viewport no matter where the selection is.

## What Changes

- Detect how much viewport space is available *below* the selection anchor when
  the comment bubble is shown.
- When there is not enough room below, open the bubble **above** the anchor
  instead of overflowing the bottom edge.
- Clamp the bubble horizontally and vertically within the viewport so it is
  never placed off-screen, in either the initial show path or the scroll-driven
  reposition path.
- Preserve all existing bubble behavior: it still tets to the selection while
  the pane scrolls, dismisses on outside click / Escape, and routes through the
  same Comment → textarea → Save flow.

**Version:** bug fix → **PATCH, v2.11.1**. The bump must land in the same
commit across the `index.html` first-line comment, the header badge
(`v2.11.1`), and `sw.js` `CACHE_VERSION` (`osviewer-2.11.1`).

## Capabilities

### New Capabilities

_(none — no new capability is introduced.)_

### Modified Capabilities

- `review`: adds a requirement that the comment popup used to annotate a
  highlighted selection stays fully within the viewport. The current `review`
  spec describes the review panel and the highlight/comment workflow, but says
  nothing about how the comment popup is positioned relative to the viewport
  edges. This change adds that requirement (and its flip-above behavior when
  there is no room below).

## Impact

- **`app/annotations.js`**: the comment bubble placement in `showAnnBubble()`
  and `repositionBubble()` — replace the always-below `rect.bottom + 8`
  positioning with a space-aware calculation that flips above the anchor when
  needed and stays within the viewport.
- **`styles/variables.css`** unchanged; no layout/serving change.
- **No JavaScript dependency, API, or serving/installation change.**
- No test change is expected to the existing suites; the positioning is pure
  DOM/CSS behavior not covered by node unit tests today.
