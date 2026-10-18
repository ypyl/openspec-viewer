# Proposal

## Why

The viewer used to poll every open folder on a 10s timer, so an external edit showed up on its own. That poll re-walked the whole tree, which is expensive (a reload over a large `archive/` on a WSL/9p mount takes seconds), so it was replaced by a manual Reload control. The common editing loop, though, is: open an artifact, edit it in another window, look back at the viewer. Today that needs a Reload and a re-open. Watching only the artifact on screen restores the useful half of live updates at the cost of stat-ing one file.

## What Changes

- While a folder is active and an artifact is displayed, the viewer watches **that artifact only** and refreshes the open view in place when the file changes on disk.
- The watch reads only the open artifact's own file modification time. It does not walk a folder, read sibling artifacts, or touch any background folder.
- On change, the refresh behaves like a scan of that one artifact: re-read content, rebuild its diff against the persisted baseline, update its unread/diff indicators, and re-render the open view (content or diff, whichever is shown) with the usual "artifact updated" notice.
- The watch belongs to the active folder's currently open artifact. Switching artifact, switching folder, or opening nothing stops watching the previous one.
- Session-only upload folders are not watched (nothing to re-read from disk); no open artifact means nothing is polled.
- The reload control and scoped group reads are unchanged. The watch is an addition, not a replacement, and does not change what a reload reads.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `change-monitoring`: add a requirement that the artifact currently open in the active folder is tracked for external changes and auto-refreshed, reading only that artifact.

## Impact

- `app/store.js`: a single watch loop that stats the open artifact and reuses the existing snapshot/diff/commit path for one rel; started and stopped on selection, folder switch, and page visibility.
- `osv-pane` / `app/state.js`: a refresh of the open artifact's view (content or diff) that patches in place and preserves scroll.
- `change-monitoring` spec gains one requirement (delta spec in this change).
- Version bump: MINOR (`4.1.0` → `4.2.0`) — visible behavior, no data migration.
- Trade-off: the open artifact is read on a timer (one stat per tick). The interval stays modest so a slow mount is not hammered; a `FileSystemObserver` would remove the timer entirely but is experimental and unverified over UNC/9p.
