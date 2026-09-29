## Why

An artifact's change is acknowledged by opening it: the diff view always acknowledges, and the content view acknowledges when there is no diff to see. When several artifacts in a folder have changed, clearing the unread markers therefore means opening each one in turn. A reader who has already reviewed a batch of changes, or who simply wants a clean slate for a folder, has no single action to acknowledge them all.

## What Changes

- Add a **Mark all as read** control to the sidebar's active-folder row, between the folder name and the close control.
- The control acknowledges every unread artifact in the active folder in one action. It acts on the active folder only.
- It reports how many artifacts are unread, and becomes unavailable when there is nothing to acknowledge rather than disappearing, so the row keeps its layout.
- A bulk acknowledge clears every unread indication for the folder: list markers, change-count labels, group counters, the folder's unread indicator, and the open artifact's tab and diff badges. Recorded diffs stay viewable.
- This adds an explicit acknowledgment path alongside the existing "seen by opening" paths, so the acknowledge requirement's wording is updated.
- No breaking changes. Shipped as a visible feature in **v3.20.0** (MINOR, all three version markers).

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `change-monitoring`: the acknowledge requirement gains an explicit bulk path, and a new requirement covers the sidebar control that provides it.

## Impact

- `app/store.js` — `markAllRead()` acknowledges the active folder's unread artifacts and clears the unread signals.
- `components/osv-file-list/osv-file-list.js` + `.css` — the control, its label, and its unavailable state.
- `components/osv-pane/osv-pane.js` — the tab-badge refresh also refreshes the diff toggle, which carries the same unseen-change badge.
- `mark-all-read-test.js` — end-to-end coverage.
- No serving, install, or dependency changes.
