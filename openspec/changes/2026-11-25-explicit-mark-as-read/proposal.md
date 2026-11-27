## Why

A change is acknowledged by seeing it: opening the diff view acknowledges, and opening the content view acknowledges when there is no diff to see. Archived changes acknowledge every artifact the moment they are opened. In practice this is backwards for review work. Opening a file to read it clears its marker, whether or not the reader actually looked at what changed, and a single open of an archived change silently clears an entire folder's worth of unread markers. Readers lose the only signal that tells them what still needs attention, and there is no way to acknowledge deliberately, one change at a time, without opening it.

## What Changes

- Remove every automatic acknowledge. Opening an artifact's content view, opening its diff view, switching tabs, navigating with the footer controls, and opening a change (active or archived) all leave read state untouched.
- Add a small **✓ mark as read** control to the sidebar list, shown on:
  - change rows (Changes and Archive) that have at least one unread artifact — it acknowledges every artifact of that change at once;
  - unread spec and config rows — it acknowledges that one artifact.
- The control disappears from a row once nothing is unread there, so the list itself still shows what needs attention. Activating it never opens or navigates to the change.
- The folder-level **Mark all as read** control stays as the bulk path.
- The explicit path reuses the existing per-artifact acknowledge (content hash against the current file), so persisted read state, group counters, tab badges, and the diff toggle behave exactly as before.
- No breaking changes for serving, install, or storage. Shipped in **v4.4.0** together with the Changes "done" badge (MINOR: visible behavior change plus a new control, all three version markers).

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `change-monitoring`: acknowledge becomes explicit-only; per-change and per-artifact controls are added; the archived-change bulk acknowledge on open is removed.
- `artifact-navigation`: footer navigation explicitly leaves read state untouched.

## Impact

- `app/store.js` — one shared `acknowledgeRels()` path behind `markAllRead()`, plus the new `markChangeRead(key)` and `markFileRead(rel)`.
- `components/osv-pane/osv-pane.js` — drops `acknowledgeShown()`/`acknowledgeArchivedChange()` and their call sites; viewing is now purely a render path.
- `components/osv-file-list/osv-file-list.js` + `.css` — the per-row ✓ control and its wiring.
- `index.html`, `components/osv-header/osv-header.js`, `sw.js` — version markers.
- Tests: `diff-test.js` and `archive-read-test.js` now assert that viewing acknowledges nothing and drive the new controls; the remaining end-to-end suites are unaffected.
- No serving, install, or dependency changes.
