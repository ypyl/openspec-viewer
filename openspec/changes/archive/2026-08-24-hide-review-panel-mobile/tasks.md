## 1. Hide the review panel on narrow screens

- [x] 1.1 Add a narrow-screen rule to `components/osv-review/osv-review.css` (with the other breakpoint queries): `@media (max-width: 61.99em) { osv-review { display: none; } }` — the review panel must take no layout space and offer no controls below 62em, while the ≥62em column rules stay untouched (see design.md D1/D2).
- [x] 1.2 Bump the version markers together in the same commit: `index.html` first-line comment, `components/osv-header/osv-header.js` `VERSION`, and `sw.js` `CACHE_VERSION` → `3.7.0` / `osviewer-3.7.0`. No new files under `app/`/`components/`, so `sw.js` SHELL and `index.css` imports are unchanged.

## 2. Verify

- [x] 2.1 Extend `mobile-drawer-test.js` with a below-62em assertion that `osv-review` is not visible and the content pane spans the full width (no reserved review section below the content); keep an assertion (or confirm the existing one) that at ≥62em the review column still renders.
- [x] 2.2 Run the e2e suites against a local server (`python -m http.server 8743`, then `playwright-cli run-code --filename=<test>.js`): `mobile-drawer-test.js` (unchanged desktop part + new review assertions), plus `whole-file-comment-test.js` and `review-guidance-test.js` to confirm the review panel still works at desktop width. Report the results.
- [x] 2.3 Manual mobile spot-check in DevTools device toolbar (<62em): header toggle opens the nav drawer, content pane fills the viewport with no review section at the bottom; resize to ≥62em and confirm the review column, checklist, and Copy prompt reappear.
- [x] 2.4 Push to `master` and verify the auto-deploy: header badge shows `v3.7.0` on the live site.