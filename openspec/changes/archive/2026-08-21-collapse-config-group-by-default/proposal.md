## Why

The file list's group headers (Changes / Specs / Archive / Config) all start expanded on a first visit except Archive. The Config group holds the store's `config.yaml` and `config/` files, which are rarely the focus when browsing artifacts, so a first-time visitor is greeted with an expanded row of config noise they did not ask to see.

## What Changes

- The **Config** group header is collapsed by default on first visit, matching the existing Archive behavior.
- The per-user expand/collapse choice keeps working exactly as it does for Archive: the choice is persisted (localStorage via the `osviewer.collapsed` signal) and honored on subsequent visits, so a user who expands Config keeps it expanded.
- The change applies only to visitors with no persisted collapse state (first visit); existing persisted choices are untouched.
- Version bump: **MINOR** (visible behavior change) — `v2.16.0` across all three version markers (index.html first-line comment, osv-header.js `VERSION`, sw.js `CACHE_VERSION`).

## Capabilities

### New Capabilities
- `file-list`: Sidebar artifact list group headers — their fixed order, expand/collapse behavior, first-visit defaults, and persistence of the user's choice.

### Modified Capabilities
<!-- None: no existing capability has requirements changing. Change monitoring's
     group counters and content-search's group ordering are unaffected. -->

## Impact

- `app/state.js` — the default value of the `collapsed` signal changes from `['Archive']` to `['Archive', 'Config']` for first-time visitors; persistence logic is untouched.
- `components/osv-file-list/osv-file-list.js` — no code change expected; it already consumes the signal and persists toggles.
- Version markers — index.html first-line comment, `VERSION` in components/osv-header/osv-header.js, `CACHE_VERSION` in sw.js, all bumped to 2.16.0 in the same commit.
- Tests — add a Playwright e2e covering the new default and persistence (existing tests do not cover collapse state).
- Not affected: search force-open behavior (searching already expands all groups), sticky Changes header, serving/offline/install path.
