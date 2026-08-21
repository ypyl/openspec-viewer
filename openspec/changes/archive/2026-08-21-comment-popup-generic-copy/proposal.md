## Why

The comment popup's copy assumes every comment is a fix request. Its textarea
placeholder reads "What should be fixed?" and the primary button says "Save
comment" opposite a bare "Cancel". But comments can also be plain observations
or questions — the review flow even has an explain mode where the model only
answers — so the wording should be neutral and not imply a highlight always
warrants a change.

## What Changes

- Change the textarea placeholder in the comment popup from "What should be
  fixed?" to a generic prompt such as "Add a comment…".
- Review the popup's action buttons and align their wording with generic
  commenting rather than fix-requests. The current buttons (**Cancel** /
  **Save comment**) are already neutral; only the placeholder carries the
  fix-request framing, so no button label needs to change. The primary action
  stays "Save comment" and the dismiss action stays "Cancel".
- No change to comment behavior: saving, highlight creation, and the overlap
  check all work as before. Only the placeholder text changes.

**Version:** copy tweak with a visible text change → **PATCH, v2.17.1**. The
bump must land in the same commit across the `index.html` first-line comment,
the header badge (`v2.17.1`), and `sw.js` `CACHE_VERSION`
(`osviewer-2.17.1`). No change to how the app is served or installed.

## Capabilities

### New Capabilities

_(none — no new capability is introduced.)_

### Modified Capabilities

- `review`: the comment popup's editor SHALL present a generic placeholder that
  does not frame the comment as a fix request, so observations and questions
  are not implied to be change requests. No other review behavior changes.

## Impact

- `app/annotations.js` — the hardcoded textarea placeholder string in
  `showAnnBubble` (`placeholder="What should be fixed?"`).
- `index.html` + `sw.js` — version-marker bump (comment, header badge,
  `CACHE_VERSION`).
- No API, dependency, or serving changes.
