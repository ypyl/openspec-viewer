## Context

The header search is a web component (`osv-search`) that owns one input (`.s-input`) and one results dropdown (`.s-drop`), both created once in `connectedCallback` and patched in place. Clearing today exists only as a keyboard path: the input's `keydown` handler treats `Escape` as "clear value, hide dropdown, `clearSearchMarks()`". Folder switches use the same reset sequence via `resetForFolderSwitch()`. See proposal.md — Why for motivation and the delta spec for the required behavior.

## Goals / Non-Goals

**Goals:**
- A visible, accessible clear control inside the search input, present only while the input has text.
- The button performs exactly the existing reset (clear query, close dropdown, remove transient marks) and returns focus to the input.
- No new dependencies, no markup outside the component, no change to search semantics.

**Non-Goals:**
- Changing search behavior, shortcuts, grouping, or the folder-switch reset.
- Replacing the `Escape` path — the button complements it.
- Any change outside `components/osv-search/` except the version markers.

## Decisions

**Overlay the button inside the input** (`.s-input` wrapped by the flex `.osv-search` container, button absolutely positioned at the right edge) rather than placing it beside the input. Rationale: a search-box ✕ inside the field is the conventional affordance and keeps the header row layout untouched. Alternative (sibling button in the flex row) was rejected — it widens the control and changes the header's width behavior.

**Show/hide via the `hidden` attribute toggled in the existing `input` event handler**, not CSS `:placeholder-shown` or content queries. The `input` event already fires per keystroke; toggling a boolean is the simplest patch-in-place update and keeps focus/selection untouched. `hidden` is set by default in the initial markup so the button never flashes in.

**Reuse the reset sequence by extracting it into a private method** (e.g. `clearSearch()`) called by the `Escape` key handler, the clear button, and `resetForFolderSwitch()`. One reset path means the button and keyboard can never drift. The button's click handler additionally calls `input.focus()` afterward so a new query can be typed immediately (the spec requires focus return).

**Glyph as text character (✕) inside a `<button type="button">`**, mirroring the project's existing unicode-glyph buttons (e.g. ☰ in `osv-header`) — no SVG sprite, no icon dependency. The button carries `aria-label="Clear search"`, `tabindex` defaults (a real button), and inherits theme colors via CSS custom properties. `type="button"` is defensive (the app has no forms, but it costs nothing).

**Right padding on `.s-input`** (≈ 26px) so typed text never scrolls under the button. The button sits inside the padded field, vertically centered, with a hover state and a `:focus-visible` ring consistent with the input's focus treatment.

## Risks / Trade-offs

- Button overlaps input text if padding is forgotten → the design explicitly reserves right padding; the task checklist verifies text visibility.
- Clicking the button also bubbles to the document-level click listener that closes the dropdown — harmless (the reset closes it explicitly and idempotently), noted so no one "fixes" it later.
- The reset path is shared with `Escape`; a regression in one affects both → single method, covered by the manual e2e check in tasks.
- No functional risk to search indexing or rendering — the change is confined to one component's DOM + CSS.

## Migration Plan

Single-page app, no data migration. Deploy is the normal GitHub Pages push to `master`. Rollback is reverting the commit. Version markers (`index.html` comment, header badge, `sw.js` `CACHE_VERSION`) bump to **v3.17.0** in the same commit as the feature.
