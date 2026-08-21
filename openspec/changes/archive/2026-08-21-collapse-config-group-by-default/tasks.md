## 1. Implementation

- [x] 1.1 Change the first-visit default of the `collapsed` signal in `app/state.js` from `['Archive']` to `['Archive', 'Config']` so Config is collapsed by default (Design D1). No change to the persistence toggle or list rendering — the existing signal + localStorage machinery stays untouched.
- [x] 1.2 Bump the version to `2.16.0` (MINOR) in the same commit as 1.1 across all three markers: the `index.html` first-line comment, `VERSION` in `components/osv-header/osv-header.js`, and `CACHE_VERSION` in `sw.js`, keeping them in sync.

## 2. Verification

- [x] 2.1 Add a Playwright e2e test (playwright-cli against `python -m http.server 8743`) for the collapse behavior, using a cleared/fresh localStorage context and a stubbed folder that includes `config.yaml`/`config/` files. Assert: on first load the Config header has the `collapsed` class; clicking it expands the group; the expanded choice persists across a reload; and the archive behavior is unchanged.
- [x] 2.2 Run the new e2e test plus the existing `diff-test.js` to confirm no regression in the file list, and report results.
- [x] 2.3 Run `npm test` (node unit tests) to confirm the model/path tests still pass.
- [x] 2.4 Push to `master` and verify the live GitHub Pages version badge shows `v2.16.0`.
