## 1. Capture folder identity (store.js + model.js)

- [x] 1.1 Add a pure `parseGitIdentity(configText, headText)` helper in `app/model.js` that returns `{ origin, branch } | null` from `.git/config` (`[remote "origin"]` → `url = ...`) and `.git/HEAD` (`ref: refs/heads/<name>`), returning null on any malformed input; add `tools/test-model.mjs` cases (origin+branch, no origin, detached HEAD, garbage) and verify `npm test` passes
- [x] 1.2 In `registerPickFolder`: set the entry's `relation` from the resolved root (`root` is the `openspec/` child → `'repo'`, root is the picked dir → `'root'`); for `'repo'` picks, best-effort read `.git/config` + `.git/HEAD` from the picked handle via `parseGitIdentity`, wrapped so any failure yields `git: null` and never blocks folder open; persist via the existing `saveFolderEntry`. Verify: open a repo-root folder and an openspec-root folder in the running app — the former shows identity, the latter relation-only, no errors in console
- [x] 1.3 In `addUploadFolder`: derive `relation` from the raw `webkitRelativePath` (a segment after the first equal to `openspec` → `'repo'`, else `'root'`), `git: null` always. Verify: upload both kinds of folders via the `#picker` fallback (`setInputFiles`) and see the correct relation
- [x] 1.4 In `autoReopen`: carry `relation` and `git` from the persisted row into the rebuilt entry so restored folders keep their identity. Verify: open a repo-root folder, reload the page, and confirm the identity still shows for the restored folder

## 2. Display identity and bump the version

- [x] 2.1 Sidebar: extend the folder-row render in `components/osv-file-list/osv-file-list.js` with a muted sub-line under the project name (repo pick: `openspec/` + ` · origin · branch` when git known; root pick: `openspec root`; hide the sub-line entirely when the entry has no identity), add the sub-line style to `osv-file-list.css`, keeping the patch-in-place render. Verify: open two same-named folders (e.g. two git checkouts) — their sub-lines differ; a legacy folder (no identity fields) shows no sub-line
- [x] 2.2 Rail: extend the avatar tooltip in `components/osv-folder-rail/osv-folder-rail.js` (`title`) to append the identity (relation phrase + git origin/branch when known) after the name+suffix. Verify: hovering a non-active folder's avatar shows its identity, per the project-switcher delta spec
- [x] 2.3 Bump version markers in the same commit: `index.html` first-line comment, `components/osv-header/osv-header.js` VERSION, `sw.js` CACHE_VERSION (MINOR). Verify: header badge shows the new version after a hard reload with SW bypassed

## 3. Regression and e2e verification

- [x] 3.1 Run `npm test` and verify the unit suite (model, diff, search) still passes
- [x] 3.2 Serve on 8743 (`python -m http.server 8743`) and run the existing Playwright e2e suites that touch folder handling — `diff-test.js`, `migration-test.js`, `multi-folder-test.js` — and verify they pass unchanged
- [x] 3.3 In `multi-folder-test.js` (or a small addition to it), assert the identity sub-line and rail tooltip render for a stubbed repo-root folder and are absent for a legacy folder. Verify the suite passes via `playwright-cli run-code --filename=multi-folder-test.js`