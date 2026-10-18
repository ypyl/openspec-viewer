# Design

## Context

See `proposal.md` for motivation. Relevant current state:

- `app/store.js` owns all folder reads. `scan()` walks a set of groups, stats files, and for each **modified** file re-reads content, diffs it against the persisted snapshot (`diffLines(snap.text, text)`), computes unread state, writes the snapshot, and invalidates the pane cache. It commits results for the walked groups, then mirrors them into the view signals when the folder is active.
- `app/state.js` holds the projection: `currentRel` is the displayed artifact, `allFiles`/`fileState`/`diffInfo`/`recentRels`/`paneCache` are the active folder's maps.
- `osv-pane` renders content and diff into light DOM. `osv:refresh-current` re-runs `openChange`/`openFile`, which rebuilds the whole pane and resets scroll to the top.
- There is no background timer: the previous 10 s per-folder poll was removed in `replace-polling-with-reload` (v4.0.0).
- Folders are File System Access (`kind: 'pick'`) or session-only uploads (`kind: 'upload'`); uploads have no live disk to watch.

## Goals / Non-Goals

**Goals:**

- Restore automatic refresh for the artifact on screen, reading only that one file.
- Reuse the existing snapshot/diff/unread path so an auto-refresh is indistinguishable from a scan of that artifact.
- Keep the reading cost proportional to one artifact, not to the folder.

**Non-Goals:**

- Watching sibling artifacts, other groups, or background folders. Those still surface on reload or group expand.
- Detecting new or removed files in the open change (that is a folder read).
- Replacing the reload control or changing the scoped-read rules.
- Watching uploaded (session-only) folders.

## Decisions

### One timer for the displayed artifact, owned by store.js

A single module-level `setInterval` reads the displayed artifact only. On each tick it looks up the active folder's `fileState` entry for `currentRel`, stats that one handle, and compares `lastModified`. Store owns it because it owns reads and snapshots; `state.js` stays DOM-free projection.

Alternatives considered: per-folder timers (the removed design — re-walks, the exact cost we are avoiding); a `FileSystemObserver` per directory (rejected: experimental, and its behavior over a WSL/9p or UNC mount is unverified).

### A short fixed interval, paused while the page is hidden

The tick is one `getFile()` stat, so a few seconds is cheap and feels immediate; a full-folder poll needed ~10 s to stay tolerable. Use a single named constant (default 3000 ms). Skip the tick when `document.hidden` and run one immediate check on `visibilitychange` so a tab that was in the background catches up at once instead of waiting a full interval.

### Extract a single-artifact refresh from `scan()`

`scan()`'s per-file body (stat → re-read → diff against snapshot → unread → write snapshot → invalidate pane cache) is lifted into a helper `refreshOne(folderId, rel, handle)`. The tick calls it for `currentRel` and updates `fileState` for that rel. This keeps diff/unread/notice semantics identical to a scan and avoids a second, drifting implementation.

Alternatives considered: calling `scan()` with a one-file scope. Rejected: `scan()` walks directory roots and merges groups; a synthetic single-file scope would still traverse the tree to find the handle we already hold.

### Re-render the body in place, preserving scroll

A scan-driven refresh dispatches `osv:refresh-current`, which re-runs `openChange`/`openFile` and jumps to the top. Auto-refresh gets its own lighter path: a new `osv:auto-refresh` event handled by `osv-pane` that re-renders only `this._body` (content or diff for `currentRel`), refreshes the diff toggle and tab badges, and restores the previous `scrollTop`. If the change has tabs, the tab bar is left intact: the watch reads one artifact, so tab membership cannot change.

### Guard against overlapping work

Skip a tick while the folder is mid-scan (`scanning` set) or while a previous tick is still running, and skip when the active folder is an upload or nothing is displayed. This avoids racing the snapshot writes a reload is doing.

## Risks / Trade-offs

- **One stat per interval over a slow mount** → the interval is modest, hidden tabs are skipped, and the cost is one round trip, not a tree walk.
- **Re-render can drop a text selection or comment bubble** → scroll is preserved and the pane renders in place; a selection made mid-tick is rare and the user can re-select. (Out of scope: pausing the timer while a comment is being drafted.)
- **Auto-refreshed change then reported again on reload** → `refreshOne` advances the snapshot's `mtime`/`text`, so a later reload sees no further change (see spec delta scenario).
- **The watch can't see a brand-new sibling file** → deliberate; a folder reload (or group expand) still covers that.
- **Timer holds a handle after folder close** → the tick re-resolves the active folder every tick, and closing/switching clears the projection, so a stale handle is never read.

## Migration Plan

No data migration. Behavior is additive; rollback is removing the timer start/stop calls. Version bump MINOR (`4.1.0` → `4.2.0`), applied across `index.html`, the header `VERSION`, and `sw.js` `CACHE_VERSION` in the same commit.

## Open Questions

- None that affect the spec or the task breakdown. The exact interval is a tunable constant.
