## 1. Remove the header whole-file comment button

- [x] 1.1 Remove the `comment-toggle` button and its `.comment-toggle-slot` from the pane bar in `components/osv-pane/osv-pane.js`, including `wholeFileCount`, `commentToggleHtml`, `refreshCommentToggle`, and the delegated `.comment-toggle` click handler.
- [x] 1.2 Remove the whole-file modal dialog (`_cf`), `openCommentDialog`, and `saveCommentDialog` from `components/osv-pane/osv-pane.js` and their DOM wiring.
- [x] 1.3 Remove the `.comment-toggle*` rules from `components/osv-pane/osv-pane.css`.

## 2. Add change-title selection as the whole-file comment entry point

- [x] 2.1 Mark the change-head `<h2>` in `components/osv-pane/osv-pane.js` with a stable `class="change-title"` marker so it can be detected as a whole-file comment target.
- [x] 2.2 Extend the selection flow in `app/annotations.js` so a selection wholly inside the `.change-title` element opens the comment bubble in whole-artifact mode (distinct from the existing `.annotatable` range flow).
- [x] 2.3 In whole-artifact mode, make the bubble's SAVE call `saveFileComment(currentRel, comment)` (creating a `kind:'file'` comment) instead of storing an anchored highlight, preserving the "entire artifact" pill and `Scope: entire artifact` prompt behavior.
- [x] 2.4 Guard the whole-artifact save against a null/empty `currentRel` so nothing is written when no artifact tab is active.

## 3. Update copy

- [x] 3.1 Update the review panel's empty-state text in `app/annotations.js` (`rv-empty`) to reference selecting the change title instead of the removed header `💬` button.

## 4. Tests and version

- [x] 4.1 Update `whole-file-comment-test.js` to add a whole-file comment by selecting the change title rather than clicking `.comment-toggle`, and update its assertions (no header button/badge) accordingly.
- [x] 4.2 Apply a MINOR version bump in the same commit across the three markers: `index.html` first-line comment, `osv-header.js` `VERSION`, and `sw.js` `CACHE_VERSION`.
- [x] 4.3 Run `npm test` and the updated E2E test; verify no regression in anchored range comments and that the header button is gone.
