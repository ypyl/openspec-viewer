## Context

See proposal.md — Why/What. The app currently adds whole-document comments only
through a `💬` button in the pane-bar header (the comment toggle slot) that
opens a modal dialog. Whole-file comments are stored as `kind:'file'` entries
per artifact, shown in the review panel with an "entire artifact" pill and no
quoted snippet, and emitted in the prompt as `Scope: entire artifact`. Anchored
range highlights use a completely separate flow: text selection in the
`.annotatable` content opens a floating comment bubble that saves an anchored
highlight. The change-head `<h2>` (change title) sits above the tab bar in both
the change and archive views; it is plain light-DOM text and currently
participates in no annotation flow.

## Goals / Non-Goals

**Goals**
- Whole-document comments are triggered by selecting the change title, matching
  the existing select-then-comment mental model, with no header button.
- The whole-file comment type, storage, review-panel display, and prompt output
  stay byte-for-byte the same (`kind:'file'`, "entire artifact" pill, no
  snippet, `Scope: entire artifact`).

**Non-Goals**
- Not reworking the anchored range-highlight flow.
- Not changing the review panel, prompt.js, or the `kind:'file'` persistence
  shape.
- Not adding any new persistent control or menu.

## Decisions

### D1: Remove the header button and its editor dialog, reuse the selection bubble

Delete the pane-bar `comment-toggle` button, its count badge, the
`wholeFileCount`/`commentToggleHtml`/`refreshCommentToggle` helpers, the
delegated `.comment-toggle` click handler, and the `.comment-toggle*` CSS rules.
Also remove the whole-file modal dialog (`_cf`) and its
`openCommentDialog`/`saveCommentDialog`, since the selection bubble editor
replaces it.

**Why over keeping the modal**: the modal was bound to a button that is being
removed; reusing the in-content comment bubble keeps a single comment editor and
matches how users already comment on the change title.

### D2: Route title selection to `saveFileComment`, not the anchored flow

Extend the selection handler so that when the selection falls entirely within
the change title element (a dedicated marker such as `.change-title` on the
`<h2>`), the bubble opens in "whole-artifact" mode: the SAVE action calls
`saveFileComment(currentRel, comment)` (produces `kind:'file'`) instead of
`setHighlights` with a range. The whole-file comment still targets the artifact
open on the active tab, regardless of diff/artifact view — matching today's
button behavior.

**Why over a discardable anchored title comment**: the user explicitly wants
`kind:'file'` whole-artifact comments (no quoted snippet, "entire artifact"
pill, `Scope: entire artifact`), not an anchored highlight on the title text.

**Why `currentRel`** over a new per-change target: the existing data model,
review panel, and prompt are all keyed to a per-artifact `rel`. Reusing
`currentRel` preserves every downstream behavior without a schema change.

**Alternative considered**: a dedicated comment control adjacent to the title —
rejected per requirements; the entry point must be selecting the title.

### D3: Detect the title selection by container, not by reusing `.annotatable`

Keep the existing `findAnnContainer`/`.annotatable` path for anchored comments
untouched. Add a separate branch that checks whether the selection's common
ancestor is within the change title element. Because the title is shared across
the change's tabs, "which artifact" is resolved from `currentRel` at save time
(D2), not from the selected text.

**Why over folding the title into `.annotatable`**: the title is not part of the
rendered markdown content, and a whole-file comment must not be rendered as a
highlight; treating it as a distinct target keeps the two kinds cleanly
separated.

## Risks / Trade-offs

- **Legacy scenario name retained** (OpenSpec's no-drop rule) → The `review` delta keeps the original scenario name "Adding a comment via the header button" but rewrites its WHEN/THEN to the title-selection behavior, because the schema/archive refuses to drop a scenario from a MODIFIED requirement. The name is a stale label; the requirement text and the "No header button is required" scenario state the real behavior.
- **Title selection ambiguity** (the title is one of several selectable headers)
  → Scope the branch narrowly: only selections wholly inside the `.change-title`
  element trigger whole-artifact mode; anything else falls through to the
  existing content flow.
- **Empty-state copy references the removed button** → Update the review panel's
  `rv-empty` text to describe selecting the change title.
- **`currentRel` could be null if a title appears without an artifact tab** →
  The change title only renders in the change/archive view, which always sets an
  active artifact `rel`; guard the save against a null `currentRel` anyway.
- **Stale E2E test** → `whole-file-comment-test.js` drives the old button; update
  it to select the title and save.

## Migration Plan

- Ship as one MINOR version bump (visible feature change) across the three
  markers (index.html comment, header badge, `sw.js` `CACHE_VERSION`) in the
  same commit.
- Existing persisted `kind:'file'` comments need no migration: the storage shape
  is unchanged; only the entry point changes.
- Rollback: the header button returns trivially since the comment model is
  untouched.

## Open Questions

None.
