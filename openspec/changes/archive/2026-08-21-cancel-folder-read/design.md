## Context

The initial folder read is `scan(true)` inside `startMonitoring()`, triggered both by `pickFolder()` (fresh pick) and `autoReopen()` (re-opening the last folder on reload). It walks the whole tree with `walkDir`, stat-ing every file (`handle.getFile()` for `lastModified`) and, for changed files, doing the full `handleText` → snapshot/diff pipeline. Progress is surfaced through `setLoading('Reading folder… N files')`, which drives the full-screen `osv-loading` overlay — a static spinner+message with no cancel affordance. Poll scans (`scan(false)` via a 10s `setInterval`) never show the overlay, so the blocking wait — and thus the place a cancel belongs — is the initial read. `isScanning` already guards against overlapping scans.

The overlay is `position: fixed; inset: 0`, so it blocks interaction with everything behind it; nothing today can dismiss it mid-read except a tab reload. Cancel therefore needs two halves: a UI affordance (setLoading must be able to surface a cancel action) and a mechanism in the scan loop to stop cooperatively (`AbortController`/`AbortSignal` — the File System Access `getFile()`/`.text()` calls take no signal, so cancellation is between files, not mid-file).

## Goals / Non-Goals

**Goals:**
- A Cancel button (plus `Escape`) on the loading overlay that aborts the in-progress folder read.
- A cooperative `AbortSignal` path through `scan()` that stops the walk promptly, skips state commit, and lets a subsequent scan run.
- On cancel: loading clears, `dirHandle` is cleared, polling is not started, and the persisted handle is dropped so the app doesn't re-attempt the same read on the next reload.
- Zero new dependencies; browser-native `AbortController`/`AbortSignal` only.

**Non-Goals:**
- Cancelling the brief upload fallback (`loadFiles`) — it is fast and does not block meaningfully.
- Interrupting a single in-flight file read — cancellation is cooperative between files.
- A "run in background" / partial-results mode — cancel stops the read entirely and clears state (see D2).

## Decisions

### D1: Cooperative AbortSignal in the scan loop

`scan()` accepts an optional `signal`. The directory walk (`walkDir`) and the per-file loop both check `signal?.aborted` at each iteration and bail out early when set. Because `handle.getFile()`/`.text()` cannot be passed a signal, cancellation is between artifact reads, not mid-read — which is the right granularity: a single file read is milliseconds, the aggregate read is what takes time.

On abort the scan returns an `'aborted'` status and skips the entire commit block (building `fileState`/`allFiles`, the unread set, toasts, and the auto-open event) so no partial result set is ever presented. The `finally` still clears the loading overlay and resets `isScanning`, guaranteeing a later scan can run.

- **Why cooperative + between-files**: the File System Access API exposes no abort for individual reads; checking between files is cheap and yields promptly without threading an exception handler through every await.
- **Alternative rejected**: throwing an `AbortError` and catching it in callers. A sentinel status is more explicit and avoids swallowing unrelated errors from the `try`'s error-catch paths.

### D2: Cancel semantics — abort to pre-read state, clear the saved handle

Cancelling a folder read stops it entirely and returns the app to the pre-read state: `scan` commits nothing, `startMonitoring` does not start the poll timer or dispatch auto-open, and `dirHandle.value` is reset to `null` so the app shows the empty "open a folder" state. The persisted handle is also cleared, so a reload does not re-stick the user on the same slow read.

- **Why clear the handle**: keeping it would make the very next reload re-enter the slow read with no user action, violating the change's purpose ("never stuck waiting"). Clearing it is deterministic: cancel means "I don't want this read to happen again automatically".
- **Why not partial-results mode**: committing whatever was read before the cancel (then letting the 10s poll finish the job in the background) is friendlier but adds real complexity — a "cancelled but partially loaded" state, auto-open edge cases, and snapshot/baseline reconciliation. YAGNI for a control whose stated job is "never be stuck". If it proves desirable later it is additive, not a rework of this design.

### D3: The loading overlay takes an optional cancel action

`setLoading(msg, action)` extends the existing helper: when an action `{ cancel: fn }` is supplied, `osv-loading` renders a Cancel button next to the spinner/message; the button and an `Escape` key handler both call `fn` and clear the overlay. When no action is supplied (upload loading, other calls), the overlay renders exactly as today — no button — so cancel is opt-in and only the scan path enables it.

The overlay is styled as a dialog (`role="dialog"`, `aria-modal`) when it shows a cancel button, the button gets a real `<button>` element (focusable, Enter/Space works), and pressing `Escape` cancels. The overlay is otherwise unchanged.

- **Why extend the existing component rather than a new one**: `osv-loading` already owns this surface; adding an optional button is the minimal change and avoids a second full-screen overlay competing for the same slot.
- **Why opt-in via the action arg**: keeps the helper's default behavior identical, so only callers that support cancellation surface it.

### D4: One controller per scan; new scans abort their predecessor

`startMonitoring` creates an `AbortController` for the initial scan and stores it in a module-level reference. `scan` uses its signal, and `startMonitoring` checks the aborted status after the scan before starting the poll. Any subsequent `startMonitoring` (a new pick) aborts the previous scan's controller first, so the `isScanning` guard cannot wedge a fresh read behind a stale cancelled one. Poll scans pass no signal (no overlay, no cancel affordance) but otherwise share the same `isScanning` guard.

- **Why a controller per scan rather than one global**: a poll scan is not user-cancellable and should not be passable to `scan`'s abort semantics; scoping the controller to the initial read keeps the lifecycle simple and observable.
- **Why abort prior on start**: `pickFolder` cannot run while the overlay blocks clicks, but `autoReopen`/state transitions should still be safe from overlap; aborting the prior controller makes the guard a belt-and-suspenders rather than a correctness dependency.

### D5: Version bumped to v2.13.0 by the proposal

New visible control → MINOR. The implementing commit bumps all three markers together: `index.html` first-line comment, header badge, `sw.js` CACHE_VERSION. No `app-delivery` requirement changes (the version bump is the existing marker convention; no serving/offline/CDN behavior changes).

## Risks / Trade-offs

- [A single very large file cannot be interrupted mid-read] → Acceptable: cancellation between files stops the aggregate read promptly; a single file read is typically sub-millisecond for markdown artifacts.
- [Cancelling clears the persisted handle, so an accidental cancel forces re-picking the folder] → Deliberate trade-off (D2) to guarantee the app never re-sticks on reload; the cost is minor (re-navigate in the picker).
- [Escape-to-cancel could conflict if some focused element later uses Escape for another purpose] → Today no component consumes Escape globally; the handler is scoped to the overlay being visible. Revisit only if another Escape surface appears.
- [Snapshots written before the cancel remain in IndexedDB] → Harmless: a fresh pick clears snapshots on its next run, and a reload reconciliation path (`autoReopen`) already tolerates partially-updated snapshots; nothing in the app assumes an atomic batch.

## Migration Plan

No data migration (no new IDB stores or schema changes; a cancelled scan may leave some already-written snapshots, which existing logic already tolerates). Deployment is the usual static push; the bumped `CACHE_VERSION` guarantees returning users get the new asset graph. Rollback is reverting the release commit (version markers revert together).

## Open Questions

- Whether, after cancelling, the app should retain the last folder for quick re-opening (vs. fully forgetting it, D2) — deferred as a minor UX preference; the spec scenarios as written (return to pre-read state; opening a folder again works) are met by the chosen behavior.
