## 1. Reposition the toast

- [x] 1.1 In `components/osv-toast/osv-toast.css`, change the base anchor from `right: 16px` to `left: 16px` (keep `bottom: 16px`).
- [x] 1.2 Add a `≥62em` rule placing the toast at `left: calc(var(--rail-w) + 16px)` so it clears the left folder rail.
- [x] 1.3 Remove the `body:has(.review-drawer.open) osv-toast .toast { right: 376px; }` override and its comment (the drawer is right-side; a left toast never conflicts).
- [x] 1.4 Update the "bottom-right" wording in the `osv-toast.css` header comment and the `components/osv-toast/osv-toast.js` top comment to "bottom-left" (no logic changes).

## 2. Version bump (MINOR — visible change, same commit)

- [x] 2.1 Read the current `VERSION` in `components/osv-header/osv-header.js` and bump the MINOR digit; confirm the new version.
- [x] 2.2 Update the `index.html` first-line comment to the same new version.
- [x] 2.3 Update `sw.js` `CACHE_VERSION` to `osviewer-<new-version>` so returning users get the new shell.

## 3. Verification and deploy

- [x] 3.1 Serve (`python -m http.server 8743`) and verify: toast appears bottom-left at ≥62em, offset right of the folder rail; still bottom-left when the review drawer is open; correct on a narrow viewport.
- [x] 3.2 Run `npm test` to confirm no unit regressions.
- [x] 3.3 Push to `master`, wait for the GitHub Pages deploy, and verify the header badge shows the new version and the deployed toast is bottom-left.