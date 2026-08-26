## Why

The only way to attach a whole-document review comment is a `💬` button in the
artifact's pane-bar header (the comment toggle slot). That button is the sole
entry point for whole-file comments, so the affordance is easy to miss and it
duplicates the natural "select something, then comment" flow the app already
uses for range highlights. Users want to comment on a whole artifact by
selecting the change title instead, so the dedicated header button can go.

## What Changes

- **Remove** the whole-file comment `💬` button from the comment toggle slot in
  the pane bar (its CSS, count badge, and refresh hooks).
- **Make the change title** (the `<h2>` in the change header) selectable so a
  user can select it and add a review comment, in both the change section and
  the archive section.
- Selecting the title and saving a comment creates a **whole-artifact comment**
  (`kind:'file'`) for the artifact currently open under the title — the same
  type, "entire artifact" pill, no quoted snippet, and `Scope: entire artifact`
  in the copied prompt. Comment type, review-panel display, and prompt behavior
  are otherwise unchanged.
- Update the review panel's empty-state copy that currently references the
  header `💬` button.
- Update the `whole-file-comment` E2E test to add the comment by selecting the
  title rather than clicking the header button.
- Version **MINOR** bump (visible feature change): index.html first-line
  comment, header badge, and `sw.js` `CACHE_VERSION` in the same commit.

## Capabilities

### New Capabilities
- none

### Modified Capabilities
- `review`: the "add a whole-file review comment" requirement changes how a
  whole-artifact comment is triggered — selecting the change title instead of a
  persistent header button. The comment's type, storage, review-panel display,
  and prompt handling are preserved.

## Impact

- `components/osv-pane/osv-pane.js` — remove the `comment-toggle` button and its
  slot (`wholeFileCount`, `commentToggleHtml`, `refreshCommentToggle`, the
  delegated `.comment-toggle` click handler, and the `.comment-toggle*` CSS);
  make the change-head `<h2>` an annotatable whole-file-comment target and route
  saves to `saveFileComment`.
- `app/annotations.js` — extend the selection flow so a selection within the
  change title opens the comment editor in whole-artifact mode (creates a
  `kind:'file'` comment for the active artifact instead of an anchored
  highlight); update the `rv-empty` copy.
- `components/osv-pane/osv-pane.css` — remove `.comment-toggle*` rules; add any
  title-target styling.
- `app/prompt.js` — unchanged; the `Scope: entire artifact` path already exists.
- E2E: `whole-file-comment-test.js`.
- Version markers: `index.html`, `osv-header`, `sw.js` (MINOR bump).

No files are added under `app/`/`components/`, so the service-worker SHELL and
`index.css` imports are unaffected.
