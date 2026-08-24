## Why

On narrow screens (<62em) the folder rail and artifact list are already hidden behind the mobile navigation drawer so the content pane spans the full width, but the review panel (`osv-review`) still renders as an always-visible full-width section below the content (`min-height: 28vh`). On a phone that bottom section eats scarce vertical space for a feature that is really a desktop reviewing workflow, so the mobile view should hide it too.

## What Changes

- Below the 62em breakpoint, the review panel is hidden entirely: no bottom section, no reserved space in the layout, no control reveals it. The content pane spans the full viewport width, top to bottom.
- At ≥62em nothing changes: the review panel stays in place as the right-hand layout column with its review list, checklist, and actions.
- Review items created while the panel is hidden (e.g. via a text-selection highlight in the content pane) still persist per folder and appear in the review panel when the view is shown on a wider screen. No review data is lost or migrated.
- **Version: MINOR bump** v3.6.0 → v3.7.0 (`index.html` first-line comment, `osv-header.js` `VERSION`, `sw.js` `CACHE_VERSION`) — a user-visible layout change. Not MAJOR: no feature is dropped on desktop, and the app remains fully functional on mobile.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `review`: The "Usable on narrow screens" requirement changes from "fall back to a full-width section below the content" to "hidden entirely below 62em, reachable nowhere". The "Existing review behavior preserved" requirement is scoped to ≥62em and gains the narrow-screen unavailability, including that review items recorded while hidden persist and appear on wide screens.

## Impact

- `components/osv-review/osv-review.css` — hide the panel below 62em (a narrow-screen media query), desktop rules untouched.
- No JS changes: `osv:focus-review` (`osv-review.js`) no-ops against a hidden panel; the text-selection highlight/comment popup in the content pane keeps working and items persist per folder.
- `index.html`, `components/osv-header/osv-header.js`, `sw.js` — version markers bumped together to 3.7.0.
- `screenshot.png` — no re-shoot needed (shot at desktop width; desktop layout unchanged).
- No serving/install changes (file:// guard, service worker, CDN, deployment) — `app-delivery` capability unaffected.