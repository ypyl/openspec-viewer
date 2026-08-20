## Why

The review panel is a fixed overlay (`position: fixed`, full viewport height) that slides in on top of the content pane, hiding the artifact the user is reviewing. When comparing or reading a comment against the underlying text, the user must close the drawer to see what it covered. It should behave like the file list: a real column of the layout that the content pane makes room for.

## What Changes

- Move `<osv-review>` into the layout as a true right-hand column: when open, the content pane (`osv-pane`) shrinks to make room instead of being covered; when closed, the column collapses to zero width and the pane re-expands.
- Replace the fixed, translated overlay with an in-place column whose width animates on open/close, so the pane reflows smoothly (not a slide-in that floats over content).
- On desktop widths with room for three columns, reserve the review column in place (content reflows). On narrow/mobile widths where three columns would squeeze the pane below a usable size, keep an acceptable fallback (the existing overlay drawer) so the artifact stays readable.
- Preserve all existing review behavior and wiring: open/close/toggle events, the header button and count badge, auto-open on first highlight, clicking a review item to reveal the comment's location, and the Copy-fix / Send-to-LLM actions.

**Version:** visible behavior change → **MINOR, v2.4.0**. Bump must land in the same commit across the `index.html` first-line comment, the header badge (`v2.4.0`), and `sw.js` `CACHE_VERSION` (`osviewer-2.4.0`).

## Capabilities

### New Capabilities

- `review`: the review panel — its place in the application layout, how it opens and closes, how it behaves on narrow screens, and how it integrates with the artifact pane (content making room rather than being covered). This capability did not previously exist in `openspec/specs/`; the highlights/comments/review feature shipped before the spec workflow was adopted, so this is its first spec.

### Modified Capabilities

_(none — no existing capability's requirements change)_

## Impact

- **`components/osv-review/osv-review.css`**: replace the `position: fixed` overlay rules with an in-place column; add the width transition and the responsive (mobile/overlay) fallback.
- **`index.html`**: move the `<osv-review>` element inside the `.layout` container so it participates in the flex row alongside the file list and pane.
- **`styles/global.css`**: the `.layout` row may need a tiny adjustment (e.g. `align-items: stretch` / min-width) so all three columns share full height; the mobile stacked layout is unaffected.
- **No JavaScript change expected**: the existing `open` class on `.review-drawer` and the `osv:toggle-review` / `osv:open-review` / `osv:focus-review` / `osv:review-visibility` event protocol keep working; CSS keys off the existing class.
- **No dependency, API, or serving/installation change.**
- Locked-in decisions from exploration: keep the app-shell inner-scroll model (no document-flow rewrite), collapse the column fully to 0 width when closed, fall back to the overlay below a dedicated breakpoint (~80em / 1280px), no resize handle. Flag in review if any of these should change.
