## Context

The search input already has a single global shortcut, Ctrl+K / Cmd+K, wired in `components/osv-search/osv-search.js` via a `document` keydown listener that calls `preventDefault()`, focuses, and selects the input. See proposal.md for motivation (Ctrl+P currently triggers the browser Print dialog).

## Goals / Non-Goals

- **Goal**: Ctrl+P / Cmd+P focuses and selects the search input from any state, never opening the print dialog; Ctrl+K / Cmd+K keeps working identically.
- **Non-goals**: No new shortcut discovery UI, no rebinding, no change to the results dropdown, query handling, or Escape behavior.

## Decisions

- **Extend the existing single keydown listener**: match `(e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'p')` and always `preventDefault()`. One listener, one code path, both shortcuts behave identically.
  - *Alternatives rejected*: a separate listener for P (duplicates logic), a keymap/combo abstraction (over-engineered for two keys), and suppressing print only for P while leaving K untouched (asymmetric).
- **`preventDefault()` on the shared handler**: required for P so the browser's native Print action (Ctrl+P) never fires; harmless for K, which has no browser default. This is what makes "presses Ctrl+P and the print dialog does not open" observable.
- **`input.select()` after focus**: mirrors Ctrl+K's existing behavior — selecting the query makes it easy to type over whatever is in the box.

## Risks / Trade-offs

- [Ctrl+P is a deeply baked browser print convention; hiding it could surprise power users] → Mitigation: the app has no print feature, so the print dialog is pure dead-end here; the hotkey convention the user asked for (quick-open) is the dominant intent, and the search field shows a visible focus state so the outcome is never ambiguous.
- [Shortcut suppressed while focus is inside the search input itself] → no, the document-level listener catches the keypress wherever focus is, mirroring Ctrl+K today; typing in the search box is unaffected (the P key alone still types).

## Migration Plan

- Single commit: listener change + the three version markers (index.html first-line comment, `VERSION` in osv-header.js, `CACHE_VERSION` in sw.js) bumped to **v3.13.0**, plus the new `search-hotkey-test.js` e2e.
- Rollback: revert the commit — the change is isolated to one keydown branch in one component.
- No serving/install/service-worker behavior change; the SW cache busts via the new `CACHE_VERSION` on the next reload.

## Open Questions

None.