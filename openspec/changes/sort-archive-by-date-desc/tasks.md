## 1. Ordering logic

- [x] 1.1 Add `compareArchiveDateDesc(a, b)` to `app/model.js` next to `prettyChangeName`: dated entries compare by their `date` string descending (ISO dates sort lexicographically), an entry with an empty `date` sorts after any dated entry, and ties preserve incoming order (stable sort).
- [x] 1.2 Add unit tests for the comparator to `tools/test-model.mjs`: newest-first order, undated entries last, same-date tie keeps name-ascending order, and no mutation of the input array.

## 2. Wire into the file list

- [x] 2.1 In `components/osv-file-list/osv-file-list.js` `buildListHtml()`, apply a stable sort with `compareArchiveDateDesc` to the Archive group's rows (only `g === 'Archive'`) after they are built and before rendering; confirm the Changes group keeps its existing order.
- [x] 2.2 Verify the Archive count, unread marker, and date label rendering are unchanged by the sort (rows sorted in place, same row markup).

## 3. Version bump (MINOR, same commit)

- [x] 3.1 Bump to the next MINOR version in `index.html` first-line comment and the header badge `VERSION` in `components/osv-header/osv-header.js`, and set `sw.js` `CACHE_VERSION` to match (e.g. `osviewer-X.Y.Z`).

## 4. Verification

- [x] 4.1 Run `npm test` (node --test) — the new model tests pass alongside the existing suite.
- [x] 4.2 Serve `python -m http.server 8743`, load the app via playwright-cli, pick the repo folder, expand the Archive group, and confirm rows appear newest-first with undated entries last; confirm the Changes group still lists name-ascending.
- [ ] 4.3 Run the existing `archive-read-test.js` e2e via playwright-cli to confirm archived change handling still passes with the new order.
- [ ] 4.4 Push to `master`, confirm the auto-deploy, and verify the header badge shows the new version.