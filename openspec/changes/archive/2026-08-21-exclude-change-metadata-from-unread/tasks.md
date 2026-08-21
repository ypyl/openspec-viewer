## 1. Model helper

- [x] 1.1 Add `isChangeMetadata(rel)` to `app/model.js` returning true for a change's metadata file (`rel.endsWith('.openspec.yaml')`), and re-export it from `app/render.js` alongside the other path helpers.
- [x] 1.2 Add node unit test coverage for `isChangeMetadata` (positive: active and archived `.openspec.yaml`; negative: proposal/spec/design/tasks and `config.yaml`) to the existing node `--test` suite under `tools/`.

## 2. Store: exclude metadata from unread

- [x] 2.1 In the `app/store.js` scan loop, when a file is the change's metadata file, force `isUnread = false` and persist `unread: false` in its snapshot (so a previously-unread snapshot stops reseeding).
- [x] 2.2 Seed `nextUnread` from the carried-forward `prevUnread` with metadata paths filtered out (e.g. `new Set([...prevUnread].filter(rel => !isChangeMetadata(rel)))`), and add a comment at the site explaining why metadata is kept out of `recentRels`.
- [x] 2.3 Confirm no consumer change is needed: `osv-file-list` counters/markers and the tab `+a −r` badges all read `recentRels`, so excluding metadata there makes them correct. Add a one-line note in the component only if useful for maintainability.

## 3. Version bump (MINOR)

- [x] 3.1 Bump the version markers together in one commit: the `index.html` first-line comment (`vX.Y.Z`), the header badge `<span class="version">vX.Y.Z</span>`, and `sw.js` `CACHE_VERSION = 'osviewer-X.Y.Z'`.

## 4. Verification

- [x] 4.1 Run the node unit tests for the model helper (`node --test tools/`).
- [x] 4.2 Run the Playwright e2e suite (`diff-test.js`, `migration-test.js` via playwright-cli) against `python -m http.server 8743`.
- [x] 4.3 Manual check against a live folder: creating/modifying a change's `.openspec.yaml` does not place a `new` marker or increment the group counter; opening a change without opening its Metadata tab still clears its read state; the metadata file still appears in the change list/tabs and is readable.
