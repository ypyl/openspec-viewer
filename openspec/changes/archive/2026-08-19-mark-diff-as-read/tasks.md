# Tasks: Mark diff (changes) as read

## 1. Read-state persistence

- [x] 1.1 Add a small zero-dependency content-hash helper (e.g. cyrb53 over the normalized text, matching `splitLines` normalization) in `app/diff.js`.
- [x] 1.2 Have `diffLines` return a `hash` of the new text alongside `{ hunks, added, removed, ts }`.
- [x] 1.3 In `app/store.js`, add a `readHash` field to snapshot rows: when a scan overwrites a modified file's snapshot, preserve the old `readHash` (read it from the prior snapshot held in the modified branch); the scan itself never writes `readHash`.
- [x] 1.4 Add `markRead(rel, hash)` in `app/store.js`: fire-and-forget, non-fatal `put` of the snapshot row with `readHash` set, preserving `text`/`mtime` (idempotent, like `saveHandle`).
- [x] 1.5 During `scan()`, seed the unread set per modified file: no prior snapshot → unread (new file); `snap.readHash !== hash(text)` → unread; `snap.readHash === hash(text)` → not unread (remove from the set). Unmodified files are left untouched.

## 2. Acknowledgment seams

- [x] 2.1 In `components/osv-pane/osv-pane.js`, the Diff/Artifact toggle handler: when the diff view is shown, call `markRead(rel, diffInfo.get(rel).hash)` and drop the rel from the unread set. Returning to the artifact view does not undo the read.
- [x] 2.2 In `openFile`, acknowledge a rel after rendering its artifact view only when no diff exists for it (`!diffInfo.has(rel)`); remove the blanket `clearRecentForMeta` behavior so opening a change no longer acknowledges all its files.
- [x] 2.3 In `activateTab`, apply the same no-diff-only acknowledgment per tab.
- [x] 2.4 Verify a file edited while its artifact view is open stays unread: the live `osv:refresh-current` re-render hits the "diff exists → don't acknowledge" branch and re-flags it.

## 3. Markers, freshDiffs, and copy

- [x] 3.1 Remove `freshDiffs` from `app/state.js`; derive the Diff-toggle "NEW" badge from the unread set plus `diffInfo` (unread iff rel is unread and has a diff).
- [x] 3.2 Update `components/osv-file-list/osv-file-list.js` so group counters, row dots, and the `.new` class read from the unread set.
- [x] 3.3 Update visible copy from "new" to "unread" (group counter `+N new` → `+N unread`, dot tooltip text); leave the version bump for group 4.
- [x] 3.4 Make change-count labels read-state aware: `diffTabBadgeHtml` shows only for unread rels (tab badge clears on read), and file-list `+a −r` hints reflect only unread files (change rows sum only unread files); refresh tab badges after `markRead` and update the `diffTabBadgeHtml` unit test for the new `unread` argument.

## 4. Tests, verification, and version markers

- [x] 4.1 Extend `diff-test.js` with read-state e2e scenarios via playwright-cli: opening a diff view clears the unread marker and group counter; opening a brand-new artifact's content acknowledges it; read state survives a reload; editing a read file re-flags it unread; changing a file twice while unread shows only the latest diff under a single unread marker (no change count or history).
- [x] 4.2 Run the Playwright e2e suite (`diff-test.js` and `migration-test.js`) against `python -m http.server 8743` and confirm both pass; `migration-test.js` is unchanged (no DB version bump) and still green.
- [x] 4.3 Bump the version `2.0.1 → 2.1.0` in the same commit across all three markers: the `index.html` first-line comment, the header badge, and `sw.js` `CACHE_VERSION`.
