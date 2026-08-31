## Why

The Archive group lists one row per archived change, but currently orders them by the archived directory path's alphabetical order, which surfaces oldest entries first. Users come to Archive to find recent work, so the list should show the newest archived changes first.

## What Changes

- The Archive group in the sidebar artifact list orders its change rows by archived date, newest first.
- Archived changes whose directory name carries no `YYYY-MM-DD-` date prefix sort after all dated entries, keeping a stable, predictable place for them.
- No change to the active Changes, Specs, or Config groups, and no change to what Archive contains or how it is filtered/selected.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `file-list`: add a requirement that Archive group rows are ordered by archived change date in descending order (newest first), with undated entries last.

## Impact

- `components/osv-file-list/osv-file-list.js` — change-row ordering for the Archive group in `buildListHtml()`.
- `app/state.js` — `changeMeta` already parses each archive key's date prefix (via `prettyChangeName` in `app/model.js`), so no data changes are needed; only ordering logic.
- User-visible behavior change → version bump per policy (MINOR), across `index.html` comment, header badge, and `sw.js` CACHE_VERSION.
- Not a breaking change; no effect on serving/offline behavior.