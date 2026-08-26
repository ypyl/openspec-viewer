## Why

The review panel's header toggle (top-right) uses a different glyph (▣) than the sidebar's corner toggle (top-left, ☰), even though the two buttons share the same size, shape, and pressed styling. Since the two controls are the same kind of affordance — corner toggles for side panels — they should read as identical at a glance.

## What Changes

- Swap the review panel toggle's glyph from ▣ to ☰ in `osv-header`, so the top-right control displays the exact same icon as the top-left navigation/sidebar toggle. Styling, pressed-state behavior, aria labels, breakpoint visibility, and `reviewHidden` wiring are unchanged.
- No behavior change: both toggles keep their current toggle semantics and state indication.

**Version:** cosmetic tweak → **PATCH, v3.12.1**. Bump must land in the same commit across the `index.html` first-line comment, the header badge (`v3.12.1`), and `sw.js` `CACHE_VERSION` (`osviewer-3.12.1`).

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `panel-visibility`: "Header controls hide and show side panels at desktop widths" is updated so the review panel's header control uses the same ☰ icon as the sidebar's navigation toggle, instead of a "matching corner toggle" of unspecified glyph.

## Impact

- `components/osv-header/osv-header.js` — change the `.toggle-review` button's glyph from ▣ to ☰ (line in the inline template). No markup structure, class, or wiring change.
- `openspec/changes/unify-panel-toggle-icons/specs/panel-visibility/spec.md` — delta spec for the modified requirement (MODIFIED ×1).
- e2e: `panel-toggle-test.js` does not assert the glyph, so it needs no change; verify it still passes. `review-guidance-test.js` / `mobile-drawer-test.js` unaffected (glyph only).
- Version markers → **v3.12.1** in one commit; `screenshot.png` re-shoot (header glyph changes); no serving/install/dependency changes.