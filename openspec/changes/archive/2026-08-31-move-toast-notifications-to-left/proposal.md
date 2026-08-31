## Why

Toast notifications currently appear in the bottom-right corner of the viewport. In a review-heavy workflow the bottom-right is where the review drawer lives, so toasts sit awkwardly beside it and get nudged around when the drawer opens. Placing them in the bottom-left corner, next to the folder rail, gives them a stable, out-of-the-way home.

## What Changes

- Toast notifications render in the **bottom-left** corner of the viewport instead of the bottom-right.
- On wide screens (≥62em) the toast clears the left folder rail so it never overlaps it.
- The special rule that shifts the toast when the review drawer is open is removed: the drawer is on the right, so a left-side toast never conflicts with it.
- Toast behavior is otherwise unchanged: one at a time, auto-dismiss after ~5s, error styling, slide-in animation.
- Version bump **MINOR** (visible change): `index.html` first-line comment, `components/osv-header/osv-header.js` `VERSION`, and `sw.js` `CACHE_VERSION` stay in sync in the same commit.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `app-chrome`: Adds a requirement that transient notification toasts SHALL render in the bottom-left corner of the viewport and clear the left folder rail when it is present.

## Impact

- `components/osv-toast/osv-toast.css` — positioning: `right: 16px` → `left`-based offsets; drop the `body:has(.review-drawer.open)` override (right-side drawer no longer conflicts).
- `components/osv-toast/osv-toast.js` — header comment references "bottom-right"; update wording only.
- Version markers: `index.html`, `osv-header/osv-header.js`, `sw.js` (MINOR bump, e.g. `4.x.0` — exact next number confirmed at apply time against the current `VERSION`).
- No markup/DOM changes, no API changes, no library changes, no changes to serving/delivery.