## Context

See proposal.md (Why, What Changes) and the review capability spec for the
requirements. The current review model in `app/state.js` stores highlights as a
single `highlights` signal: `Map<rel, [{ id, start, end, text, comment, ts, rel, lines }]>`,
persisted to `localStorage` under `osviewer.highlights`. Every highlight is
anchored to a text range and re-anchored after each render by
`annotations.applyHighlights()` (via the light-DOM pane's `onRendered` hook),
wrapped into `<mark class="hl">`. The review panel (`osv-review`) renders one
flat, timestamp-ordered list from `buildReviewHtml()`, and `prompt.js` folds
commented items into a single numbered LLM prompt. The pane bar
(`osv-pane.paneBarHtml`) already has a separate `diff-toggle-slot` so the diff
toggle can re-render without rebuilding the bar.

## Goals / Non-Goals

**Goals:**
- Add whole-file comments as first-class review items sharing the existing
  review list, persistence, and prompt.
- Keep the existing range-highlight machinery (re-anchoring, staleness,
  reveal-on-click) fully intact.
- Zero migration for persisted highlights.

**Non-Goals:**
- Per-change (folder-wide) comments — whole-file is per artifact file.
- Editing an existing whole-file comment in place; each save appends.
- Comment threads, replies, or resolve tracking.
- Any UI for previewing/editing the generated prompt.

## Decisions

### D1: Whole-file comment = per artifact file

The button lives in the pane bar, which is bound to the currently open artifact
(`currentRel`), so a whole-file comment always targets one file (proposal.md,
design.md, tasks.md, a spec, config, etc.). A "change" is a folder of several
such tabs; each tab can carry its own whole-file comment. Considered and
rejected: per-change comments, which would need a new attachment point (the
change header), a vaguer data model ("comment on a folder"), and a weaker signal
for the LLM to act on.

### D2: Unified, kind-discriminated review model (single `highlights` map)

Extend the existing item shape with a `kind` field: `'range'` (implicit,
backwards-compatible) and `'file'`. A file-kind item is
`{ kind:'file', id, comment, ts, rel }` — no `start`/`end`/`text`/`lines`.

- `wrapHighlight` already early-returns on missing `text`, so `applyHighlights`
  skips file-kind items for free.
- `deleteHighlight` filters by `id` only — works for both kinds.
- `allHighlights()` returns the flat list regardless of kind.
- `currentStaleIds()` gets a guard (`continue` for `kind:'file'`) — file
  comments are never stale.
- `buildReviewHtml()` branches to render a `[entire artifact]` pill instead of
  a quoted snippet.
- `buildPrompt()` branches to emit `Scope: entire artifact` instead of
  `Referenced text:`.

Alternative considered: a separate `fileComments` collection. Rejected — it
would duplicate persistence, pruning, deletion, and require two merge points
(panel + prompt) that must never drift apart, fragmenting the single "review
comment" concept. The unified model's guards are small, and existing saved
highlights (no `kind`) need no migration.

### D3: Header affordance — pane-bar `comment-toggle-slot` with a count badge

Add a `comment-toggle-slot` beside the existing `diff-toggle-slot` in
`paneBarHtml`, plus a `refreshCommentToggle(rel)` hook (parallel to
`refreshToggle`) so the button can re-render its count/active state on tab
switches without rebuilding the bar. The button shows the existing **💬** icon
with a count badge of that artifact's whole-file comments and
`title="Comment on this whole artifact"`. It is enabled in both the artifact and
diff views: a whole-file comment targets the artifact file regardless of the
current view.

### D4: Native `<dialog>` editor

Clicking the header button opens a native `<dialog>` via `showModal()`: a short
"Comment on <artifact>" title, a textarea, and **Cancel** / **Save comment**
buttons sharing the range editor's conventions (Enter saves, Shift+Enter newline,
Esc closes). Using `<dialog>` gives focus trapping, Esc handling, and a
backdrop for free, and it is the app's preferred native pattern for a
button-triggered input. Alternative considered and rejected: reusing the
selection bubble — it is Range-anchored (`positionBubble` takes a Range) and
its outside-click and scroll-dismiss behavior are coupled to the selection
story, so bending it to a header trigger would add more contortion than a
native dialog.

### D5: Multiple whole-file comments per artifact

Each save appends a `kind:'file'` item to the artifact's list, exactly like a
range highlight. No edit-vs-insert fork anywhere in the data model or panel. If
rows ever get noisy, that is a presentation problem (grouping/collapsing) to
solve later without touching the model.

### D6: Review-panel row — distinct icon, no stale, open-on-click

A file-kind row renders a distinct icon (e.g. a file glyph) where range rows
show their index number, an `[entire artifact]` pill in place of the quoted
snippet, the artifact path and comment, and a delete button. It is never marked
stale. Clicking opens the referenced artifact (if not already open) and flashes
the row; there is no text range to scroll to. Both kinds share one global
timestamp-ordered numbering so the panel and prompt stay aligned.

### D7: Prompt — `Scope: entire artifact`

In `buildPrompt()`, a file-kind item emits:

```
N. File: <rel>
   Scope: entire file
   Comment: <comment>
```

replacing the `Referenced text:` line. The existing intro (act on each comment
by intent; keep the rest of the proposal consistent) already applies. The
numbering is the shared global sequence from D6, so `1. File: …` maps 1:1 to
panel row 1.

### D8: Discoverability copy

The review panel's empty state gains a line pointing at the header **💬** button
for whole-document feedback (structure, tone, formatting), so the feature is not
hidden behind text selection.

## Risks / Trade-offs

- [Re-anchoring regression] The unified model touches the delicate range
  machinery. → `wrapHighlight` already bails on missing `text`; add the explicit
  `kind` guard in `currentStaleIds` and cover artifact-view flow with the e2e
  test.
- [`snippet(undefined)` crash] `buildReviewHtml`/`buildPrompt` call
  `snippet(h.text)`. → Both branch on `kind:'file'` before calling `snippet`.
- [Panel noise from many whole-file rows] Multiple file-kind rows accumulate.
  → Accepted; deferred presentation improvement (grouping/collapsing) is a
  non-goal for this change.
- [Diff-view semantics] The button stays enabled in diff view, where range
  highlights do not apply. → Accepted: a whole-file comment targets the artifact
  file, which is view-independent.

## Migration Plan

No data migration. Persisted highlights without a `kind` field are implicitly
`'range'` and continue to work unchanged; pruning drops whole-file comments when
their artifact is deleted, exactly as it does for range highlights. Deployment is
the normal MINOR bump (v2.18.0) with the three version markers bumped together.
Rollback: revert the version markers and the feature commit; retained whole-file
comments are harmless if a user has them, but a reverted build ignores them.

## Open Questions

None — the decisions above fully determine the specs, approach, and task
breakdown.
