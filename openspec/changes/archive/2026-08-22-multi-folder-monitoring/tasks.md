## 1. Folder state model

- [x] 1.1 In `app/state.js`, add a folder registry: a reactive `folders` signal (list of `{ id, name, kind, hue, suffix }`) and a non-reactive `Map<folderId, folderState>` holding per-folder files, unread set, selection, and the non-reactive caches (`paneCache`, `fileState`, `diffInfo`, `diffViews`); add an `activeFolderId` signal. Keep the existing exported symbols as the active folder's projection.
- [x] 1.2 Add the active-folder projection effect: on `activeFolderId` change, sync `allFiles`, `currentRel`, `currentKey`, `recentRels`, `highlights`, `searchMarks` and the non-reactive maps from `folderState[new]`, restore the folder's own `currentTabs`, bump `searchVersion`, and fire `osv:auto-open` when the folder has no selection yet.
- [x] 1.3 Add write-through helpers for selection and pane-cache writes so clicks and renders update `folderState[active]` and the projected symbols together (no drift).

## 2. IndexedDB v2→v3 migration

- [x] 2.1 Bump the IDB version to 3: new `folders` store (keyPath `id`; `{ id, name, pickedHandle, rootHandle, kind }`), `snapshots` re-keyed to composite `folderId/rel` with a `folderId` field on each row.
- [x] 2.2 Write the v2→v3 upgrade: read the old `'dir'` handle, mint one legacy folder id, write its row, cursor every snapshot row and re-key it under the legacy id; make all of it failure-tolerant (boot with no persisted folders on error, no crash).
- [x] 2.3 Re-key legacy review items: migrate `osviewer.highlights` (rel-keyed) into `osviewer.highlights.<legacyFolderId>` on first load; add the per-folder key `osviewer.collapsed.<id>`.
- [x] 2.4 Keep `saveHandle`/`loadHandle` compatibility only where the migration needs them; replace the rest of the handle persistence with the registry store.

## 3. Folder operations and per-folder monitoring

- [x] 3.1 Refactor `pickFolder`/`startMonitoring`/`scan` to be folder-scoped: `scan(folderId, initial, signal)` against `folderState[id]`, per-folder poll timers (`Map<folderId, interval>`), per-folder `isScanning`/`currentScan` (AbortController)/`baselineFresh`; mirror results to the projected signals only when that folder is active.
- [x] 3.2 Implement add: resolve the openspec root, mint a folder id, dedup via `isSameEntry` against existing roots (switch to the existing entry instead of duplicating), name-collision `#2`/`#3` suffix, hue from name; wire the upload fallback as `kind: 'upload'` (session-only, hollow avatar, no dot, no persistence).
- [x] 3.3 Implement close: remove the folder from the registry, stop its poll timer, delete its persisted snapshots and folder row (per change-monitoring spec), then activate the next folder down the rail (or the no-folder empty state).
- [x] 3.4 Background-change notices: when a scan affects a non-active folder, prefix the toast with the folder's name and mark its avatar dot; keep active-folder toasts worded as today.
- [x] 3.5 Rewrite `autoReopen` to restore every granted folder entry, run each folder's initial scan, and show ONE aggregated notice naming folders with changes since last visit plus any skipped for revoked permission; cancellable per folder with no partial entries left behind.

## 4. Folder rail component

- [x] 4.1 Create `components/osv-folder-rail/osv-folder-rail.js` + `.css`: ~60px icon column with the `+` add action at top (falls back to the upload control), one avatar button per folder (first letter, per-folder hue, name tooltip, active highlight, unread dot, hollow ring for uploads), patch-in-place render from a `computed` over the `folders` signal.
- [x] 4.2 Wire clicks: avatar → switch active folder; `+` → add flow (dedup behavior per 3.2).
- [x] 4.3 Register the component in `index.js` and add `<osv-folder-rail>` to the layout in `index.html` before `osv-file-list`; make the rail a horizontal scroll strip on narrow/mobile widths.

## 5. File-list integration

- [x] 5.1 Remove the "Select Folder to Monitor" button from `osv-file-list`; add the name + close row (active folder's ellipsized name with tooltip + square close button) to its controls.
- [x] 5.2 Make the list render only the active folder's artifacts; restore each folder's own selection and tabs on switch; show the no-folder empty state (pointing at the add action) instead of "No artifacts found." when nothing is open.
- [x] 5.3 Make collapsed-group state per folder (`osviewer.collapsed.<id>`), restored on switch and reload; clear the sidebar filter and content search when switching folders.

## 6. Search scoping

- [x] 6.1 Scope the search corpus to the active folder: snapshot rows filtered by `folderId`, corpus built on switch (`searchVersion` bump), results never mixing folders.
- [x] 6.2 Verify the content search resets on folder switch (query cleared, results scoped to the active folder) and that no query state leaks between folders.

## 7. Review data per folder

- [x] 7.1 Scope highlights/comments per folder (store under `highlights` projection per 1.2; persistence per 2.3); the review panel and header badge reflect the active folder; legacy items appear in the migrated folder.
- [x] 7.2 Make prompt paths folder-qualified: single folder keeps `openspec/…`; with N folders, prefix `name/openspec/…`; update `storePrefix` on switch (design D6).

## 8. Header and version

- [x] 8.1 Header stats reflect the active folder's counts (files / active changes / archived), and the live indicator stays tied to monitoring state; add the project name context if the stats line needs it for same-path clarity.
- [x] 8.2 Bump version markers together to 3.0.0: `index.html` first-line comment, header badge (`osv-header.js` VERSION), and `sw.js` CACHE_VERSION.

## 9. Verification

- [x] 9.1 Extend `migration-test.js` (Playwright) to cover v2→v3: legacy handle + snapshots migrate to the legacy folder, read state and highlights survive, folder registry rows exist.
- [x] 9.2 Add a dedicated multi-folder e2e (new `multi-folder-test.js`; keeps `diff-test.js` untouched): add two folders, switch via rail, verify list/selection/tabs swap per folder, same-path artifacts never mix, close active falls back to next-down, unread dot appears/clears, background notices prefix the folder name, upload entry shows session-only and restores nothing on reload.
- [x] 9.3 Run the full e2e suite against `python -m http.server 8743`, run `openspec validate` on the change, and verify the version badge (v3.0.0) renders after the update.