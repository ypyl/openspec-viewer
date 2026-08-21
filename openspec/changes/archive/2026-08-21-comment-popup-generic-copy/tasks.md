## 1. Implementation

- [x] 1.1 In `app/annotations.js`, change the comment popup textarea's
      `placeholder` from `"What should be fixed?"` to a generic neutral prompt
      (`"Add a comment…"`) in `showAnnBubble`
- [x] 1.2 Review the popup's action buttons (**Cancel** / **Save comment**) and
      confirm they read neutrally; change a label only if it carries a
      fix-request framing (current labels are already neutral)

## 2. Version bump (same commit as task 1)

- [x] 2.1 Bump `index.html` first-line comment to `v2.17.1`
- [x] 2.2 Bump the header badge in `index.html` to `v2.17.1`
- [x] 2.3 Bump `sw.js` `CACHE_VERSION` to `osviewer-2.17.1`

## 3. Verification

- [x] 3.1 Serve the app (`python -m http.server 8743`), open a folder, highlight
      text, and open the comment popup: confirm the placeholder reads
      "Add a comment…" and the actions are **Cancel** / **Save comment**
- [x] 3.2 Run the Playwright e2e suites (`diff-test.js` and `migration-test.js`)
      against the local server via playwright-cli and confirm they pass
