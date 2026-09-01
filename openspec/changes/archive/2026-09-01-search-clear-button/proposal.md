## Why

Clearing a search query currently requires keyboard knowledge (press `Escape`) or manual text deletion. On touch devices there is no keyboard at all, so the only way to reset a search is to erase the text character by character. A visible clear control inside the search input makes the reset obvious and works the same everywhere.

## What Changes

- Add a clear (✕) button inside the header search input that appears whenever the input contains text.
- Activating the button clears the query, closes the results dropdown, and removes transient match highlights — the same reset the `Escape` key already performs.
- Focus returns to the search input after clearing, so the user can immediately type a new query. The button is hidden when the input is empty and carries an accessible label ("Clear search") for screen readers.
- No change to search semantics: querying, grouping, shortcuts, or folder-switch reset behavior are untouched.

**Version:** new visible feature → **MINOR, v3.17.0**. Bump must land in the same commit across the `index.html` first-line comment, the header badge (`v3.17.0`), and `sw.js` `CACHE_VERSION` (`osviewer-3.17.0`).

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `content-search`: the "Search box in the app header" requirement is extended so the search input provides a visible clear control that resets the query and closes the results, complementing the existing `Escape` behavior.

## Impact

- `components/osv-search/osv-search.js` — render a clear button inside `.osv-search`, toggle its visibility with the input's value, wire its activation to the existing reset behavior (clear value, close dropdown, `clearSearchMarks()`), and give it an `aria-label`.
- `components/osv-search/osv-search.css` — style the button as a small icon overlaid on the right edge of the input, plus rules to show/hide it with the input's value.
- `openspec/changes/search-clear-button/specs/content-search/spec.md` — delta spec for the modified requirement (MODIFIED ×1).
- Version markers → **v3.17.0** in one commit; no serving/install/dependency changes; `screenshot.png` only if the header visual changes the project wants to capture.
