## 1. Data model

- [x] 1.1 Extend the review item shape in `app/state.js`: document `kind: 'range' | 'file'` on the `highlights` signal, where a file-kind item is `{ kind:'file', id, comment, ts, rel }` (no range fields) and existing saved entries without `kind` are implicitly `'range'`.
- [x] 1.2 In `app/annotations.js`, add the `kind:'file'` guard to `currentStaleIds()` so whole-file comments are never reported stale, and verify `wrapHighlight` already skips items with no `text` (no change expected there).
- [x] 1.3 Add a `saveFileComment(rel, comment)` helper that appends a `kind:'file'` item (uid, ts) to the artifact's list via the existing `setHighlights`/persist path, mirroring how `saveAnnComment` appends a range highlight.
- [x] 1.4 Confirm `deleteHighlight` (filters by id) and `pruneHighlights` (drops missing artifacts) already work for file-kind items; adjust only if needed.

## 2. Pane-bar affordance and dialog editor

- [x] 2.1 In `osv-pane.js`, add a `comment-toggle-slot` next to the existing `diff-toggle-slot` in `paneBarHtml`, plus a `refreshCommentToggle(rel)` hook (parallel to `refreshToggle`) called on tab switches and after saves.
- [x] 2.2 Render the header **💬** button in the slot with a count badge of that artifact's whole-file comments and `title="Comment on this whole artifact"`; keep it enabled in both artifact and diff views.
- [x] 2.3 Add a review-comment editor using a native `<dialog>` via `showModal()`: a "Comment on <artifact>" title, a textarea, and **Cancel** / **Save comment** buttons sharing the range editor's conventions (Enter saves, Shift+Enter newline, Esc closes).
- [x] 2.4 Wire the header button to open the dialog and, on Save, call `saveFileComment` and refresh the slot's count badge.

## 3. Review panel rendering

- [x] 3.1 Branch `buildReviewHtml` for `kind:'file'`: render a distinct icon (where range rows show their index number), an `[entire artifact]` pill in place of the quoted snippet, the artifact path, the comment, and a delete button; never mark it stale or call `snippet` on it.
- [x] 3.2 Add open-on-click behavior for file-kind rows: clicking opens the referenced artifact (if not already open) and flashes the row, with no scroll-to-mark.
- [x] 3.3 Keep one global timestamp-ordered numbering shared by both kinds so panel rows and prompt entries stay aligned.

## 4. Prompt

- [x] 4.1 Branch `buildPrompt` for `kind:'file'`: emit `Scope: entire artifact` instead of the `Referenced text:` line, preserving the shared sequence numbering and matching the panel order.

## 5. Copy, version, and verification

- [x] 5.1 Update the review panel's empty-state copy to mention the header **💬** button for whole-document feedback (structure, tone, formatting).
- [x] 5.2 Bump to v2.18.0 (MINOR) across all three markers in the same change: `index.html` first-line comment, the header badge `v2.18.0`, and `sw.js` `CACHE_VERSION` (`osviewer-2.18.0`).
- [x] 5.3 Add a Playwright e2e test (`whole-file-comment-test.js`) against `python -m http.server 8743`: open an artifact, click the header **💬**, type and save, assert a distinct whole-file row appears in the review panel and that "Copy prompt" contains `Scope: entire artifact`.
- [x] 5.4 Run the existing e2e suite (`diff-test.js`, `migration-test.js`) and confirm it stays green with the new feature.
