## Context

The header's two corner controls (.nav-toggle top-left, .toggle-review top-right) already share the same 30×30 bordered styling, pressed-state accent, and aria wiring; the only difference is the glyph — ☰ vs ▣. See proposal.md for motivation.

## Goals / Non-Goals

- **Goal**: The review toggle renders the same ☰ glyph as the sidebar toggle, with zero behavioral change.
- **Non-goals**: No rework of the corner-toggle styling, no icon library, no change to toggle semantics, aria labels, breakpoints, or the `reviewHidden` signal.

## Decisions

- **Swap the text glyph in the inline template only**: change `.toggle-review`'s content from ▣ to ☰ in `osv-header.js`. This keeps the two buttons byte-identical in markup and relies on the existing CSS group selector (`osv-header .nav-toggle, osv-header .toggle-review { … }`) that already styles them as one look.
  - *Alternatives rejected*: an SVG/mask icon or icon font would introduce a rendering dependency and duplicate what the app already does with a plain text glyph (the theme button and nav toggle use emoji/unicode text too); a CSS-generated icon would be over-engineered for a one-character swap.
- **No CSS change**: the shared corner-toggle rules already apply; nothing about sizing, hover, or pressed state differs between the buttons.

## Risks / Trade-offs

- [Two identical ☰ glyphs at opposite header corners could be momentarily confusing] → Mitigation: they are semantic per-position (left = sidebar, right = review panel), aria labels/titles already disambiguate ("Open navigation" vs "Show/Hide review panel"), and the request explicitly asks for the same icon.

## Migration Plan

- Single commit: glyph swap + the three version markers (index.html first-line comment, `VERSION` in osv-header.js, `CACHE_VERSION` in sw.js) bumped to **v3.12.1**, plus a re-shot `screenshot.png` (header glyph is visible in it).
- Rollback: revert the commit — the change is isolated to one button's text content.
- No serving/install/service-worker behavior change; the SW cache busts via the new `CACHE_VERSION` on the next reload.

## Open Questions

None.