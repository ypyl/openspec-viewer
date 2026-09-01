## 1. Clear button in the search input

- [x] 1.1 Add the clear button to the `osv-search` template — a `<button type="button">` with glyph ✕, `aria-label="Clear search"`, `hidden` by default — and verify it renders inside the input wrapper with no flash when the page loads with an empty input
- [x] 1.2 Extract the shared reset sequence (clear value, hide dropdown, `clearSearchMarks()`) into a private `clearSearch()` method used by the `Escape` handler, the clear button, and `resetForFolderSwitch()`, and verify `Escape` still behaves exactly as before
- [x] 1.3 Wire the clear button's click to `clearSearch()` plus `input.focus()`, and toggle the button's `hidden` attribute in the existing `input` event handler; verify: typing shows the button, clicking it clears the query, closes the dropdown, removes transient highlights, returns focus to the input, and the button hides again
- [x] 1.4 Style the button (absolute, right edge of the input, vertically centered, theme-colored, hover state, `:focus-visible` ring) and add right padding to `.s-input`; verify typed text never runs under the button and the focus treatment matches the input's
- [x] 1.5 Bump version markers to **v3.17.0** in the same commit — `index.html` first-line comment, header badge, `sw.js` `CACHE_VERSION` — and verify `grep` shows all three in sync

## 2. Verification

- [x] 2.1 Serve locally (`python -m http.server 8743`) and run the existing e2e suites via playwright-cli (`diff-test.js`, `migration-test.js`); verify they pass
- [x] 2.2 Playwright e2e check of the new behavior: focus search (Ctrl+K), type a query, assert the clear button is visible; click it, assert the input is empty, the dropdown is closed, and focus is back on the input; assert the button is absent when the input is empty
- [x] 2.3 Regression check: after clearing once, type a new query and click a result; verify the artifact opens at the match with snippet highlights intact, then push to `master` and verify the deployed header badge shows v3.17.0
