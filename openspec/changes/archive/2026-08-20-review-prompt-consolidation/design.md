## Context

See proposal.md — Why. Today `app/prompt.js` builds a verbose "fix" prompt that
tells the model to read the whole proposal from the repository and apply strict
rules; the review panel exposes two actions (Copy fix, Send to LLM), and Send to
LLM opens `osv-prompt-modal` for preview/edit/open-in-new-tab. We are consolidating
to one self-describing prompt and one copy action, and deleting the modal.

## Goals / Non-Goals

**Goals:**
- One immutable prompt string produced from the collected highlights/comments.
- One review action that copies that string to the clipboard.
- Delete the modal component, its event, and its page element with no leftovers.

**Non-Goals:**
- Two prompt modes or any mode selector/state.
- Any special-casing of "open questions" sections — the user highlights and
  comments on them, and the fix instruction covers it.
- Persisting the prompt text anywhere; it lives only on the clipboard.

## Decisions

**1. Single prompt template, self-describing and intent-driven.**
`buildPrompt()` output becomes:
```text
Here are my review comments on my OpenSpec artifacts. Act on each comment based on
what it asks:

- If the comment asks me to fix, adjust, or edit the referenced text, apply that
  change.
- If the comment is itself a question about the referenced text (e.g. "what does
  this mean?"), do NOT change the spec. Just answer / explain it in place.

Where an edit is needed, also update any other artifacts in the same proposal that
the change affects, so the whole proposal stays consistent.

1. File: <storePrefix><rel>
   Referenced text: "<snippet>"
   Comment: <comment>
2. …
```
The `/Referenced text/…` / `Comment` block is built exactly as today (per-file
`##` headings from `storePrefix + rel`, numbered comment lines with `snippet()`
for the reference). The heavy preamble (read the proposal from the repo, strict
"only change the referenced text" rule) is dropped so the prompt is self-contained
and honest about what was reviewed. *Alternative rejected: keeping a fix/explain
mode selector and running the same data through two templates — more UI and state
for a distinction the prompt can carry on its own.*

**2. One button, no modal.**
`osv-review` renders a single **Copy prompt** (primary) button in its actions row.
Clicking it awaits `buildPrompt()`, then `copyText()`, then a toast. The Send-to-LLM
button, the `osv:show-prompt` dispatch, and the `document` listener are removed.
`osv-prompt-modal` is deleted wholesale: its component file, its CSS, its import in
`index.js`, and its `<osv-prompt-modal>` element in `index.html`. The modal was the
only consumer of the "Open in new tab" affordance, so that goes too. This suits the
Plain Vanilla Web "prefer native" rule — `navigator.clipboard` already handles the
copy with a `document.execCommand` fallback in `copyText()`.

**3. Comment gate unchanged.**
The new Copy button is disabled when no highlight has a comment, using the exact
same `items.some(h => h.comment)` check the current buttons use; `buildPrompt()`
returns `null` in that case as today. A question-as-comment is still a comment and
passes the gate.

**4. Version bump MINOR → v2.12.0.**
User-visible behavior change (removed modal, single action). Bump all three markers
(index.html comment + header badge, sw.js `CACHE_VERSION`) in the same commit.

## Risks / Trade-offs

- [Users lose the ability to preview/edit the prompt before copying] → Accepted by
  design; a badly-shaped prompt is corrected by editing the highlight/comment and
  recopying. The prompt is deterministic per comments, so it is reproducible.
- [Deleting "Open in new tab" removes a grab-able text file path] → Accepted; the
  clipboard copy covers the primary flow, and most browsers copy as-is.
- [Consistency clause assumes the LLM can see sibling proposal files] → Mitigated by
  listing full file paths (including the proposal folder) so the model can derive
  them; the user supplies the files/repo when pasting as needed.
