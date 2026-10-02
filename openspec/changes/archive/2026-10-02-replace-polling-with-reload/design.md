# Design

## Context

See `proposal.md` for motivation.

Today `app/store.js` funnels every read through one routine, `scan(folderId, initial, signal, opts)`: it walks the folder handle, diffs content against persisted snapshots, updates unread state, and mirrors the result into the projected signals. Two call sites drive it:

- `startMonitoring()` does the initial read on add/re-open, then registers `setInterval(() => scan(folderId, false, null, { toast: true }), 10000)` in a per-folder `pollTimers` map. `closeFolder()` clears the timer via `stopTimer()`.
- The `initial` argument only toggles the reading overlay (`setLoading`) and its progress text. The unread baseline ("nothing is new yet") is governed separately by `baselineFresh`, so a scan's behavior does not actually depend on `initial`.

Cancellation already exists: `startMonitoring` stashes an `AbortController` in `scanAborters`, and the overlay's cancel button (and Escape) aborts it. `scan` also refuses to run when its folder is already in the `scanning` set.

The header (`components/osv-header`) shows a "● live" badge whenever any pick folder is open.

## Goals / Non-Goals

**Goals:**
- One scan code path reused by add, re-open, and manual reload; no second read implementation.
- Remove the timer loop and its bookkeeping without disturbing the initial read, diffs, unread tracking, notices, or search reindexing.
- A reload that rescans exactly one folder (the active one) with the same progress + cancel UX as an initial read.

**Non-Goals:**
- No automatic or background change detection of any kind (explicitly dropped).
- No per-folder reload for background folders, and no "reload all".
- No change to the snapshot/diff/unread data model, or to the reload's effect on those.

## Decisions

**Reuse `scan(folderId, true, signal, { toast: true })` for the reload.** `initial: true` gives the reading overlay and progress for free, which matters for large folders; it does not alter diff/unread semantics (see Context). Alternative: call it with `initial: false` so there is no overlay — rejected, a reload of a big tree would look frozen.

**Wrap the reload in its own `AbortController` registered in `scanAborters`.** This makes the overlay's existing cancel button and Escape work during a reload, matching the initial read. Alternative: let the reload run uncancellable — rejected as inconsistent with the read UX the user already has.

**Delete the timer machinery outright** (`pollTimers`, `stopTimer`, the `setInterval`, and the `stopTimer` call in `closeFolder`) rather than gating it behind a setting. A hidden "poll on/off" flag would be dead flexibility; the feature is gone. Keeps `startMonitoring` as "read once, register handles".

**Reload entry point lives in `app/store.js`** (e.g. `reloadActiveFolder()`), not in a component: it owns the abort bookkeeping and reads `activeFolderId`. It no-ops for a missing active folder or an upload-kind entry. The header imports and calls it.

**Control placement: the header, replacing the "● live" badge** (`.side` area, next to the theme button). The badge described a behavior that no longer exists, so it is removed rather than kept alongside. The control is disabled when no folder is active or the active folder is a session-only upload. Alternative: put it in the sidebar folder row next to "Mark all as read" — rejected, because the header is the app-level refresh affordance and its stats already describe the active folder. *(Recorded assumption; the request only fixed the reload's scope, not its location.)*

## Risks / Trade-offs

- **Stale data until the user clicks** — the core trade-off of dropping polling. Mitigation: a visible Reload control, plus the existing "changes since your last visit" notice on re-open so nothing is silently missed.
- **Reload looks dead on an upload folder** — the button is disabled for those, so the affordance is clear instead of a silent no-op.
- **Slow large-folder reload** → the reading overlay and cancel are retained.
- **Version bump churn** — dropping automatic monitoring is a breaking behavior change, so the change carries a MAJOR bump (3.21.0 → 4.0.0) across the three markers; `sw.js`'s cache version bump also retires the old shell for returning users.

## Migration Plan

No data migration. Remove the timer code and add the button/entry point in one commit, bumping `index.html`, `osv-header.js` `VERSION`, and `sw.js` `CACHE_VERSION` together. Rollback is reverting that commit.
