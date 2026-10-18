# Tasks

## 1. Single-artifact refresh path

- [x] 1.1 Lift the per-file body of `scan()` in `app/store.js` (stat → re-read → diff against the persisted snapshot → unread decision → write snapshot → invalidate the pane cache) into `refreshOne(folderId, rel, info)` and call it from the scan loop unchanged; verify `npm test` and the existing `scoped-read-test.js` / `diff-test.js` still pass against the server on `:8743`.
- [x] 1.2 Make `refreshOne` return what the caller needs to update `st.fileState[rel]`, `st.diffInfo`, `st.recentRels`, and the pane cache for just that rel; verify an auto-refresh produces the same diff, unread marker, and "artifact updated" notice as a normal scan (asserted in 4.1).

## 2. Watch the displayed artifact

- [x] 2.1 Add a single module-level watch timer in `app/store.js` that stats only the active folder's displayed artifact (`currentRel`), with `startWatch`/`stopWatch` and a guard that skips the tick when nothing is displayed, the active folder is a session-only upload, a scan is running, or a previous tick is still in flight; verify no file reads occur with no artifact displayed (e2e hook in 4.1).
- [x] 2.2 Start/stop the watch when the selected artifact or active folder changes and when a folder is closed, so only the displayed artifact is read; verify switching artifacts stops reading the previous one.
- [x] 2.3 Skip ticks while `document.hidden` and run one immediate check on `visibilitychange`; verify a change made while the tab was hidden surfaces as soon as it is shown.

## 3. Refresh the open view in place

- [x] 3.1 Add an `osv:auto-refresh` handler in `components/osv-pane/osv-pane.js` that re-renders only `this._body` (content or diff for `currentRel`), refreshes the diff toggle and tab badges, and restores the previous `scrollTop`; verify the tab bar is untouched and scroll is preserved.
- [x] 3.2 Route an active-folder `refreshOne` result to `osv:auto-refresh` (not `osv:refresh-current`); verify an external edit shows the new content and a rebuilt diff without a page reload and without jumping to the top.

## 4. Tests, docs, version

- [x] 4.1 Add `auto-refresh-test.js` (root, playwright-cli, server `:8743`) covering the spec delta: an external edit refreshes the displayed artifact and flags it unread; an unopened sibling is not read and is unaffected; the diff view is rebuilt against the previous content; a background folder is left alone; switching the displayed artifact moves the watch; a refreshed artifact is not reported again by the reload control; scroll position survives the refresh. Expose a one-tick test hook in `app/testbridge.js`.
- [x] 4.2 Update `README.md` and `AGENTS.md` to describe open-artifact auto-refresh and that sibling/background changes still surface on reload or group expand.
- [x] 4.3 Bump the version `4.1.0 → 4.2.0` in `index.html`, `components/osv-header/osv-header.js` (`VERSION`), and `sw.js` (`CACHE_VERSION`); verify all three read `4.2.0`.
- [x] 4.4 Run `npm test` and the existing e2e tests (diff, reload, scoped-read, multi-folder, archive-read, mark-all-read) against the server on `:8743` to confirm no regression.

## Workflow follow-up

- Sync the `change-monitoring` main spec from this change's delta and archive the change.
