## 1. Implementation

- [x] 1.1 Add a bulk-acknowledge step in `components/osv-pane/osv-pane.js`'s `openChange`: when the change key starts with `changes/archive/`, mark every artifact in the change read against its current content (read live text, compute its hash, and reuse the existing per-rel markRead + `recentRels` path). Gate it strictly to archived changes so active changes keep per-tab `acknowledgeShown` behavior unchanged (Design D1–D4).
- [x] 1.2 Bump the version to `2.17.0` (MINOR) in the same commit as 1.1 across all three markers: the `index.html` first-line comment, `VERSION` in `components/osv-header/osv-header.js`, and `CACHE_VERSION` in `sw.js`, keeping them in sync.

## 2. Verification

- [x] 2.1 Add a Playwright e2e test (playwright-cli against `python -m http.server 8743`) for the archive bulk-read behavior: stub an archived change with multiple artifacts and an active change with a sibling; seed unread state; then assert that opening the archived change clears all of its unread markers and the Archive group counter at once, that reloading (keepSnapshots) keeps it read, and that a sibling in an active change stays unread until opened individually.
- [x] 2.2 Run the new e2e test plus the existing `diff-test.js` and `migration-test.js` to confirm no regression in read-state handling, and report results.
- [x] 2.3 Run `npm test` (node unit tests) to confirm the model/path tests still pass.
- [x] 2.4 Push to `master` and verify the live GitHub Pages version badge shows `v2.17.0`.
