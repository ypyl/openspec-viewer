## 1. Task progress from file content

- [x] 1.1 Add `isTasksRel(rel)` (a `tasks.md` under `changes/`) and `taskProgress(text)` (`{ total, done }` from the task checkboxes) to `app/model.js`, and make the tasks progress bar in `app/render.js` use the same counter. Verify: `npm test` covers both helpers and the Tasks tab still renders its progress bar.
- [x] 1.2 Record each change's progress in the folder state (`taskState`, mirrored by a `taskState` signal in `app/state.js`) wherever `tasks.md` is read: `refreshOne` for a folder read and the open-file watch, the persisted snapshot when the file did not change, and once for an upload folder. Drop the entry when `tasks.md` disappears. Verify: the map is cleared on a fresh folder read and repopulated for every change.

## 2. The badge

- [x] 2.1 Render a done badge next to the change name in a Changes row when `tasks.md` exists, has at least one task, and every task is checked; tooltip carries the count. Never on Archive rows, on changes with open tasks, or on changes without `tasks.md`. Verify: `done-badge-test.js` reports no errors.
- [x] 2.2 Style it in `components/osv-file-list/osv-file-list.css` as the same pill as the artifact badges, in the tasks/progress green, so the row keeps its height whether or not the badge is present.

## 3. Version markers

- [x] 3.1 Bump to **v4.4.0** in the same commit: the `index.html` first-line comment, `export const VERSION` in `components/osv-header/osv-header.js`, and `CACHE_VERSION` in `sw.js`. Verify: all three markers read 4.4.0 and the deployed header badge renders `v4.4.0`.

## 4. Documentation

- [x] 4.1 Describe the badge in the README feature list and list `done-badge-test.js` in `AGENTS.md`. Verify: the docs match the app.

## 5. Verification

- [x] 5.1 Run `npm test`, then the end-to-end suites against `python -m http.server 8743` (`done-badge-test.js` plus diff, migration, multi-folder, collapse, archive-read, reload, scoped-read, auto-refresh, mark-all-read, whole-file-comment, review-guidance, tab-nav, search-hotkey, mobile-drawer, panel-toggle), and report the results.
