# Tasks

## 1. Bounded walk

- [x] 1.1 Add a pure group→path mapping in `app/model.js` (Changes → `changes/` excluding `changes/archive/`; Archive → `changes/archive/`; Specs → `specs/`; Config → `config.yaml` + `config/`) and cover it in `tools/test-model.mjs` with a unit test; verify `npm test` passes.
- [x] 1.2 Reuse that mapping in a bounded `walkDir` in `app/store.js` that walks only the given group roots instead of the whole `rootHandle`; verify a reload with Archive collapsed does not read archive files (asserted in 4.1).

## 2. Scoped scan

- [x] 2.1 Make `scan()` take the set of groups to read and rebuild only those groups' entries in `st.files`/`st.fileState`/`st.recentRels`/`st.diffInfo`, leaving unwalked groups untouched; verify with the e2e in 4.1 (a collapsed group keeps its entries and unread state).
- [x] 2.2 Pass "all groups" from `startMonitoring` (first read) and "expanded groups plus the open artifact's group" from `reloadActiveFolder`; verify the first read lists every group and a later reload does not.
- [x] 2.3 Stat a directory's files with bounded concurrency (`Promise.all` in chunks) instead of sequential `await getFile()`; verify the file list and diffs are unchanged and record a before/after timing over a stubbed tree.

## 3. Read a group on expand

- [x] 3.1 Add a store entry point that reads one group of the active folder, and call it from `components/osv-file-list/` when a collapsed group is expanded, showing the reading indicator; verify expanding Archive surfaces a change made while it was collapsed.
- [x] 3.2 Make the group counter reflect the read result after an expand; verify the counter updates (e2e in 4.1).

## 4. Tests, docs, version

- [x] 4.1 Add `scoped-read-test.js` (root, playwright-cli) covering: the first read covers every group; a reload with Archive collapsed does not pick up an archive change; expanding Archive reads it and surfaces the change and counter; the open artifact's group is read even when collapsed; run it against the server on `:8743`.
- [x] 4.2 Update `README.md` and `AGENTS.md` to describe scoped reads (collapsed groups are read on expand) instead of a full-tree reload.
- [x] 4.3 Bump the version `4.0.0 → 4.1.0` in `index.html`, `components/osv-header/osv-header.js` (`VERSION`), and `sw.js` (`CACHE_VERSION`); verify all three read `4.1.0`.
- [x] 4.4 Run `npm test` and the existing e2e tests (diff, multi-folder, archive-read, mark-all-read, reload) against the server on `:8743` to confirm no regression.
