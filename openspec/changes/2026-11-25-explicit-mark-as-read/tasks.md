## 1. Acknowledge path in the store

- [x] 1.1 Add a private `acknowledgeRels(rels, folderId)` to `app/store.js` that marks each unread rel read against its current content, drops it from the folder's `recentRels`, updates the folder's unread flag, refreshes the pane's imperative badges, and toasts the count; re-express `markAllRead()` on top of it. Verify: the folder control still clears markers, counters, the rail dot, and the tab/diff badges, and still reports the count.
- [x] 1.2 Add `markChangeRead(key)` (all unread rels whose `changeOf(rel)` equals `key`, so archived and active changes are separate scopes) and `markFileRead(rel)` (one rel). Verify: acknowledging one change leaves another change's markers alone; acknowledging one spec leaves other specs unread.

## 2. Stop acknowledging on view

- [x] 2.1 Delete `acknowledgeShown()`, `acknowledgeArchivedChange()`, and the pane's `markRead()` from `components/osv-pane/osv-pane.js`, plus their call sites in `openFile()`, `openChange()`, `activateTab()`, and the diff-toggle handler; drop the now-unused `store.js` and `diff.js` imports. Verify: opening a changed artifact, its diff, a change tab, an archived change, and a footer-navigated artifact all leave the unread markers untouched, and the open artifact's badges still clear when a row control is used.

## 3. Row controls in the file list

- [x] 3.1 Render the ✓ control in `components/osv-file-list/osv-file-list.js` on unread change rows (scope: the whole change, title carries the count) and on unread artifact rows (scope: that artifact), last in the row, with an `aria-label`. Wire clicks to `markChangeRead` / `markFileRead` with `stopPropagation()` so acknowledging does not navigate. Verify: the control appears only on unread rows, disappears once the row is read, and clicking it does not open the change.
- [x] 3.2 Style it in `components/osv-file-list/osv-file-list.css`: a 16px square green-outlined ✓ that reads as secondary to the row label; on change rows the date drops its auto margin while unread so the two sit flush right. Verify: read and unread rows keep the same height and nothing overlaps at sidebar width.

## 4. Version markers

- [x] 4.1 Bump to **v4.4.0** in the same commit: the `index.html` first-line comment, `export const VERSION` in `components/osv-header/osv-header.js`, and `CACHE_VERSION` in `sw.js`. Verify: all three markers read 4.4.0 and the deployed header badge renders `v4.4.0`.

## 5. Documentation and specs

- [x] 5.1 Update `openspec/specs/change-monitoring/spec.md`: acknowledge is explicit-only, plus the per-change and per-artifact control requirements, and the archived-change requirement rewritten to "opening acknowledges nothing". Verify: no requirement still claims that opening an artifact, a diff, or a change acknowledges it.
- [x] 5.2 Update `openspec/specs/artifact-navigation/spec.md` so footer navigation is described as leaving read state untouched, and the README's feature list to describe the explicit ✓ control. Verify: the docs match the app.

## 6. Verification

- [x] 6.1 Extend `diff-test.js`: viewing a diff no longer acknowledges (marker and counts stay), the change row's ✓ clears the change, and a brand-new spec row's ✓ clears that spec; keep the reload and re-flag scenarios. Verify: `playwright-cli run-code --filename=diff-test.js` reports no errors.
- [x] 6.2 Extend `archive-read-test.js`: opening an archived change and one of its artifacts leaves every marker and the Archive counter intact, and the change row's ✓ then clears all of them at once and stays read across a reload; an active change is acknowledged only by its own control. Verify: `playwright-cli run-code --filename=archive-read-test.js` reports no errors.
- [x] 6.3 Run the full suite — `npm test`, then the end-to-end tests (`diff-test.js`, `archive-read-test.js`, `mark-all-read-test.js`, `reload-test.js`, `multi-folder-test.js`, `migration-test.js`, `scoped-read-test.js`, `auto-refresh-test.js`, `collapse-test.js`, `tab-nav-test.js`, `whole-file-comment-test.js`, `review-guidance-test.js`, `search-hotkey-test.js`, `mobile-drawer-test.js`, `panel-toggle-test.js`) against `python -m http.server 8743`, and report the results.
