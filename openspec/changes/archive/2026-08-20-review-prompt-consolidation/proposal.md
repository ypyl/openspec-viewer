## Why

The review panel is cluttered and the generated LLM prompt is verbose and
misleading. It offers two actions (Copy fix, Send to LLM) that both funnel into a
modal, it forces the model to "read the whole proposal from the repository" (which
a pasted prompt usually cannot), and its exits are hand-wavy. Users want one button
that copies a single, self-describing prompt straight to the clipboard — no modal,
no mode selector, no preview/editing.

## What Changes

- Collapse the review actions to a single **Copy prompt** button that writes the
  generated prompt to the clipboard and confirms with a toast.
- Remove the prompt modal entirely (the `osv-prompt-modal` component, its CSS, the
  `osv:show-prompt` event, and its element in the page). The Send-to-LLM action and
  its edit/open-in-new-tab affordances go with it.
- Rewrite the generated prompt to be simpler and self-contained:
  - It lists each comment as `File` / `Referenced text` / `Comment`, describing what
    the user reviewed.
  - One instruction block tells the model to act on each comment by intent:
    - If the comment asks to fix/adjust/edit the referenced text → apply the change.
    - If the comment is itself a question about the text (e.g. "what does this mean?")
      → do **not** change anything; answer/explain it in place.
    - Where an edit is needed, also update any other artifacts in the same proposal
      that the change affects, so the whole proposal stays consistent.
- Keep the existing gate: the Copy button stays disabled until at least one highlight
  has a comment. A question-as-comment counts as a comment.
- There is no separate Open Questions handling: an open question the user wants
  answered is just highlighted and commented, and the prompt's fix instruction
  covers it.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `review`: The review panel's existing "single fix prompt" and its two-action
  Copy-fix / Send-to-LLM behavior change. The spec now mandates a single self-
  describing prompt and a single copy action, and no modal.

## Impact

- **Code**: `app/prompt.js` (rewrite `buildPrompt` output, drop the "read the whole
  proposal / rules" preamble), `components/osv-review/osv-review.js` (one button,
  remove the Send-to-LLM path), and deletion of `components/osv-prompt-modal/*`.
- **Page/index**: `index.html` drops the `<osv-prompt-modal>` element; `index.js`
  drops its import.
- **Version**: MINOR bump (new simpler UX, removes a modal) → v2.12.0 across the
  three markers (index.html comment + header badge, sw.js `CACHE_VERSION`).
- **No** serving/offline/dependency changes.
