## Why

Archived changes are the "history" of an OpenSpec store, not the focus of review. Yet each archived change behaves like an active one: opening it acknowledges only the single artifact shown on the active tab, so its unread markers, per-artifact counters, and the Archive group counter persist until every artifact inside is opened individually. For a store that archives changes routinely, this leaves lasting unread noise that takes needless clicks to clear.

## What Changes

- Opening an **archived** change (or any artifact inside it) marks **all** of that change's artifacts as read in one step — each is acknowledged against its current content, its unread marker and diff counts are cleared, and it stops counting toward the Archive group counter.
- The bulk acknowledge is **persisted** through the existing read state (IndexedDB), so the archived change stays read across reloads.
- **Active (non-archived) changes are unchanged**: their artifacts SHALL still be acknowledged individually when each is opened, preserving per-artifact review.
- The read state is acknowledged against each artifact's current content, so it does not clear a concurrent, newer change that appears after opening.
- Version bump: **MINOR** (visible behavior change) — `v2.17.0` across all three version markers (index.html first-line comment, osv-header.js `VERSION`, sw.js `CACHE_VERSION`).

## Capabilities

### New Capabilities
<!-- None: this extends the existing change-monitoring behavior. -->

### Modified Capabilities
- `change-monitoring`: Add a single requirement — opening an archived change acknowledges all of its artifacts at once (vs. per-artifact acknowledgment for active changes), persisted across reloads.

## Impact

- `components/osv-pane/osv-pane.js` — `openChange` gains a bulk-acknowledge step for archived change keys (`changes/archive/…`), marking each of the change's artifacts read (via the existing `markRead` + `recentRels` path).
- `app/store.js` — `markRead` reused as-is; it already persists `unread:false` + `readHash` to the IndexedDB snapshot and removes the rel from any unread set.
- `app/state.js` — `recentRels` reactivity already clears the Archive group counter and markers when rels leave the unread set.
- Version markers — index.html first-line comment, `VERSION` in components/osv-header/osv-header.js, `CACHE_VERSION` in sw.js, all bumped to 2.17.0 in the same commit.
- Tests — add/extend Playwright e2e coverage for archive bulk-read clearing markers and the group counter, and confirming active changes still acknowledge per-artifact.
- Not affected: diff detection/snapshots, metadata handling, search, serving/offline/install path.
