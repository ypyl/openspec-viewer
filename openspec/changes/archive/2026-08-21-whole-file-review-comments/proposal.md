## Why

Review feedback often applies to a whole document (structure, tone, language,
formatting) rather than one highlighted sentence. Today the viewer only lets the
user annotate a text range, so whole-document feedback is either forced onto an
arbitrary snippet or lost entirely. This change lets the user attach a comment to
an entire artifact and folds it into the same review panel and LLM fix prompt as
range-based comments.

## What Changes

- Add a whole-file comment affordance: a **💬** button on the artifact header
  (pane bar) that opens a small dialog to add a general comment about the current
  artifact. A count badge shows how many whole-file comments that artifact already
  carries.
- Support multiple whole-file comments per artifact; each save appends a new one,
  mirroring how range highlights accumulate.
- Extend the persisted review model so a review item is either a highlighted text
  range (`range`) or a whole-artifact comment (`file`). Saved highlights without a
  kind remain range items (no data migration).
- Show whole-file comments in the review panel alongside range highlights, marked
  with a distinct icon and an `[entire artifact]` label instead of a quoted text
  snippet. They are never marked stale and never point at a text range; clicking
  one opens the artifact.
- Fold whole-file comments into the generated LLM prompt with a
  `Scope: entire file` line in place of the `Referenced text:` line, keeping
  the same global numbering so the panel and prompt stay in sync.
- Update the review panel's empty-state copy to mention the header **💬** button
  for whole-document feedback.

This is a MINOR feature addition (no breaking changes, no layout overhaul), so it
ships as **v2.18.0** with the three version markers bumped together (index.html
first-line comment, header badge, sw.js CACHE_VERSION).

## Capabilities

### New Capabilities

- none

### Modified Capabilities

- `review`: add whole-file (artifact-wide) review comments alongside range-based
  highlights, including the header affordance, the editor dialog, review-panel
  presentation, and prompt representation.

## Impact

- **app/annotations.js**: review-item shape gains `kind: 'range' | 'file'`;
  `applyHighlights`/`currentStaleIds`/`buildReviewHtml`/`buildPrompt` branch on
  kind; whole-file items skip the range/stale machinery.
- **app/state.js**: document the extended review-item shape in the `highlights`
  signal.
- **app/prompt.js**: emit `Scope: entire file` for file-kind comments.
- **components/osv-pane/**: new `comment-toggle-slot` in the pane bar (alongside
  `diff-toggle-slot`) and a `refreshCommentToggle` hook; a generic review-comment
  editor dialog.
- **components/osv-review/**: render file-kind rows (icon, `[entire artifact]`
  pill, open-on-click) and the updated empty-state copy.
- **Version**: v2.18.0 (MINOR) — index.html, header badge, sw.js CACHE_VERSION.
- **Dependencies**: none new; native `<dialog>` only.
