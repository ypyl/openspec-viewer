## 1. Bulk acknowledge in the store

- [x] 1.1 Add `markAllRead()` to `app/store.js`: read the active folder's unread rels, acknowledge each against its current content through the existing per-artifact read path, then clear the folder's unread set and the signals derived from it (the folder's unread flag and the active folder's unread projection). Verify: activating the control clears the list markers, the group counter, and the rail unread dot, and the toast reports the count.
- [x] 1.2 Refresh the pane's imperative read indicators from the same action, since the tab badges and the diff toggle are not reactive. Verify: with a changed artifact open, the tab badges and the diff toggle's unseen-change badge both clear on one activation.

## 2. Control in the sidebar folder row

- [x] 2.1 Render the control in `components/osv-file-list/osv-file-list.js` between the folder name block and the close button, disabled with an explanatory title while nothing is unread, and labelled with the unread count when there is. Verify: the control sits between the name and the close control, reports the count, and is unavailable when the folder has nothing unread.
- [x] 2.2 Style it in `components/osv-file-list/osv-file-list.css` as a link-style control: accent when actionable, muted when unavailable, no layout shift between the two states. Verify: the enabled and unavailable states are visually distinct and the row height does not change.

## 3. Version markers

- [x] 3.1 Bump to **v3.20.0** in the same commit: the `index.html` first-line comment, `export const VERSION` in `components/osv-header/osv-header.js`, and `CACHE_VERSION` in `sw.js`. Verify: all three markers read 3.20.0 and the deployed header badge renders `v3.20.0`.

## 4. Verification

- [x] 4.1 Add `mark-all-read-test.js` covering the control's position between name and close, its unavailable state with nothing unread, its count label, one activation clearing every unread indication (list markers, hints, group counter, rail dot, tab badges, diff toggle badge), diffs staying viewable, and the acknowledged state surviving a reload. Verify: serve with `python -m http.server 8743`, run `playwright-cli run-code --filename=mark-all-read-test.js`, and report the results.
- [x] 4.2 Run the full end-to-end suite (`diff-test.js`, `archive-read-test.js`, `multi-folder-test.js`, `migration-test.js`, `tab-nav-test.js`, `panel-toggle-test.js`, `review-guidance-test.js`, `collapse-test.js`, `whole-file-comment-test.js`, `mobile-drawer-test.js`, `search-hotkey-test.js`) plus `npm test`, and report the results.
- [x] 4.3 Re-shoot `screenshot.png` with the control visible and verify the deployed badge after pushing to `master`.
