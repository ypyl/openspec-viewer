## Why

The review panel's hide/show button lives in the header (the `▣` toggle added in v3.8.0). Hiding a panel is a contextual action, and the header is already crowded (nav toggle, theme, search, stats, sidebar toggle) — a user looking to dismiss the review panel looks at the panel, not the header. The natural affordance is a close button on the panel itself, mirroring how the navigation drawer is dismissed by its own close button. The restore path (the floating 💬 pill, shown whenever the panel is hidden) already exists and stays.

## What Changes

- Remove the header review toggle (`▣`) — its markup, wiring, aria-pressed sync, and CSS — so the header keeps only the sidebar visibility toggle.
- Add a close button (✕) to the review panel itself (visible ≥62em only, hidden below 62em with the rest of the panel) that hides the panel — the same state and reflow as the removed header toggle, no behavior change to the hidden state itself.
- The restore path is unchanged: the floating pill appears whenever the panel is hidden (count shown when review items exist) and reopens the panel with its list, delete, and Copy prompt intact.
- Persistence, pane reflow, and narrow-screen auto behavior (panel hidden below 62em) are all unchanged.
- **Version bump to v3.9.0 (MINOR)** in the same commit across the three markers (index.html first-line comment, header badge `VERSION`, `sw.js` `CACHE_VERSION`).
- `screenshot.png` re-shoot required: the header loses the `▣` button and the review panel gains a close button, so the 1440×900 default viewport changes.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `panel-visibility`: the review panel's hide affordance moves from a header visibility control to a close control on the panel itself; only the file list sidebar keeps a header visibility control. The restore control (floating pill) requirement is unchanged.
- `review`: "Existing review behavior preserved" changes — the panel is hidden via its own close control (not a header control) and re-shown via the restore control; the header no longer reflects review visibility.

## Impact

- `components/osv-header/` — remove the `.toggle-review` button (markup, click handler, aria-pressed effect, and its CSS); keep `.toggle-sidebar`.
- `components/osv-review/` — add a `.review-close` button on the panel (small ✕ in a new panel title row with a "Review" label, mirroring the nav drawer's close affordance; or in the actions row — see design.md); click sets `reviewHidden = true`. No effect on the restore pill, list handlers, or Copy prompt.
- `app/state.js` — unchanged (signals, persistence, body classes stay; the review panel's hidden state is driven identically).
- Spec deltas: `specs/panel-visibility/spec.md` (MODIFIED header-controls requirement) and `specs/review/spec.md` (MODIFIED existing-behavior requirement).
- e2e `panel-toggle-test.js` — replace the `.toggle-review` header-toggle interactions with the panel close button and assert the header shows no review toggle.
- Version markers → **v3.9.0**; `screenshot.png` re-shoot; no serving/install/dependency changes.