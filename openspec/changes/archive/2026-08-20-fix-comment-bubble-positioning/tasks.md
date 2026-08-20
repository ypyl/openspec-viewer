## 1. Comment bubble placement logic

- [x] 1.1 Extract a single `positionBubble(bub, range)` helper in `app/annotations.js` that computes the bubble's final viewport-relative `top`/`left`.
- [x] 1.2 In the helper, measure the bubble's rendered height (`offsetHeight`) after it is appended (it is `position: fixed`, so appending causes no layout reflow).
- [x] 1.3 Place the bubble below the anchor (`rect.bottom + 8`) when `rect.bottom + 8 + height <= innerHeight`, otherwise flip it above (`max(8, rect.top - height - 8)`).
- [x] 1.4 Clamp both axes using the measured size so the bubble never exceeds the viewport: `left = max(8, min(rect.left, innerWidth - width - 8))` and the vertical result is bounded by `max(8, …)`.
- [x] 1.5 Replace the hard-coded `990` horizontal clamp in the helper with the measured-width clamp from 1.4.
- [x] 1.6 Recompute the popup's position with `positionBubble` when it expands to the textarea editor, so the actions stay in view near the bottom of the viewport.

## 2. Version bump

- [x] 2.1 Bump PATCH version `2.11.0 → 2.11.1` in the same commit across `index.html` (first-line comment), the header badge in `components/osv-header/osv-header.js`, and `sw.js` `CACHE_VERSION`.

## 3. Verification

- [x] 3.1 Serve locally (`python -m http.server 8743`) and confirm the comment popup opens below the selection and fully within the viewport when the anchor is in the upper/middle of the screen.
- [x] 3.2 Confirm the popup flips above the anchor (and stays fully visible) when the selection is near the bottom of the viewport.
- [x] 3.3 Confirm that scrolling the pane while the popup is open closes it (it does not jump or float off-screen).
- [x] 3.4 Confirm the full flow still works end-to-end: select text → Comment → Save comment, and that the highlight is added and the review panel updates.
