# Design

## Context

See `proposal.md` for motivation. Relevant current state:

- Acknowledge happens in `osv-pane`: `openFile()` and `activateTab()` call `acknowledgeShown(rel)` (diff view always acknowledges; the artifact view acknowledges only when the artifact has no pending diff), the diff toggle acknowledges when it switches to the diff view, and `openChange()` fire-and-forgets `acknowledgeArchivedChange(meta)` for `changes/archive/*`.
- All of those funnel into a pane-local `markRead(rel, hash)` that persists `readHash` through `store.markRead()` and then rewrites the `recentRels` signal.
- `store.markAllRead()` is the one explicit path: it acknowledges every unread rel of the active folder against its current content and then clears the folder's unread set, the folder's unread flag, and the pane's imperative badges.
- The file list renders from `recentRels` inside `osv-file-list` and re-renders in place when it changes; rows are plain click targets that dispatch `osv:select-rel` / `osv:select-change`.

## Goals / Non-Goals

**Goals:**

- Make reading a pure view operation: no code path outside an explicit control touches read state.
- Give the reader a per-change and per-artifact acknowledge without opening anything.
- Keep one acknowledge implementation, so persisted state, counters, and badges cannot drift between the three controls.
- Keep the list cheap to render: the control is a few nodes on rows that are already unread.

**Non-Goals:**

- No per-artifact checkboxes, multi-select, or acknowledge-on-scroll.
- No change to how unread state is detected, persisted, or scoped per folder.
- No change to the folder-level bulk control, its position, or its unavailable state.

## Decisions

### D1 — Acknowledgment lives in the store, not the pane

`store.js` gains a private `acknowledgeRels(rels, folderId)` that marks each rel read against the text currently on disk (`hashText(readFileText(rel))`), drops it from the folder's `recentRels`, updates the folder's unread flag, dispatches `osv:refresh-tab-badges`, and toasts the count. `markAllRead()`, `markChangeRead(key)`, and `markFileRead(rel)` are thin scopes over it (whole folder, `changeOf(rel) === key`, one rel).

Why: the pane's old `markRead` had to hand-patch `recentRels` and refresh badges itself. Keeping the only acknowledge path in the store means the signals derived from read state are updated in exactly one place, and the pane no longer needs store imports at all.

### D2 — The pane forgets about read state entirely

`acknowledgeShown()`, `acknowledgeArchivedChange()`, and the pane's `markRead()` are deleted along with the four call sites. `openFile()`, `openChange()`, `activateTab()`, and the diff toggle become pure render paths. The pane still *renders* badges from `recentRels`/`diffInfo` and still answers `osv:refresh-tab-badges`, so a row click clears the open artifact's tab and toggle badges through the shared store path.

### D3 — Row control only where something is unread

The ✓ is rendered only on a row that already carries the green unread dot (change rows: at least one unread artifact; file rows: that artifact is unread). The row therefore never changes layout while it is read, and the control that clears a marker is always the one attached to it. Tooltips state the scope ("Mark all N unread artifacts in this change as read" vs "Mark as read"), and the button carries an `aria-label`.

The click handler calls `stopPropagation()` so acknowledging does not also open the change — a row click is navigation, a ✓ click is bookkeeping.

Placement: last in the row, pushed right by `margin-left: auto`; on change rows the date gives up its own auto margin while the row is unread so the two do not split the free space.

### D4 — No confirm, no undo

Acknowledge is cheap and repeatable: the artifact's diff and content stay readable, and any later change re-flags the artifact unread. A confirmation dialog would add friction to the one action whose purpose is to remove friction, and an undo stack would need its own persistence story.

## Risks / Trade-offs

- **Readers who liked "opening marks it read" now must click.** That is the point of the change (the old path acknowledged files nobody read), but it costs one click per change. Mitigated by the per-change scope (one click acknowledges all of a change's artifacts) and by the folder-level control still being one click away.
- **The control is discoverable only on unread rows.** Accepted: the green dot already draws the eye there, and the tooltip states the scope. No keyboard shortcut is added — `/`, `Ctrl/Cmd-K`, and Escape are already taken, and a global "mark read" key would be ambiguous without a selection model.
- **A row-level click racing a scan** could acknowledge a hash that is already stale. It resolves the same way the old path did: the next scan compares the new content against the stored `readHash` and re-flags the artifact unread.

## Migration

None. Read state, snapshot keys, and stored hashes are unchanged; only the triggers moved. Users with already-unread artifacts keep them, and now clear them deliberately.
