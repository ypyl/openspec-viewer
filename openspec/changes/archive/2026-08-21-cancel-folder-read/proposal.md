## Why

Opening or re-opening an openspec folder triggers a full read of every artifact (walking the tree, stat-ing each file, and reading+snapshotting the changed ones) behind an opaque full-screen loading overlay. On a large folder — or an import that stalls — the user is stuck watching a spinner with no way to stop, short of reloading the tab.

## What Changes

- Add a **Cancel** control to the loading overlay shown while a folder is being read, so the user can abort an in-progress read instead of being stuck waiting. `Escape` triggers the same cancel.
- Cancel is wired through an `AbortSignal`: the scan loop checks it cooperatively between artifact reads and stops promptly, the overlay closes, and the app returns to its pre-read (empty / "open a folder") state rather than a partial or stuck one.
- Cancelling a fresh folder pick also forgets the persisted folder handle, so the app never re-attempts the stuck read on the next reload.
- No change to how the app is served or installed; no new dependencies (browser-native `AbortController`/`AbortSignal`). Not breaking; new visible control → **v2.13.0** (MINOR), bumped across all three version markers in the same commit.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `change-monitoring`: add a requirement that an in-progress folder read can be cancelled — the app shows a cancel control during the read, stops the read on cancel, and returns to a clean pre-read state instead of leaving the UI stuck.

## Impact

- **`components/osv-loading/`** (`osv-loading.js` + `.css`): the overlay gains an optional Cancel button (shown only when a cancel action is supplied); clicking it or pressing `Escape` aborts. The `setLoading()` helper accepts an optional cancel handler so callers opt in.
- **`app/store.js`**: `scan()` accepts an `AbortSignal`, checks it between artifact reads and skips its state-commit block when aborted; `startMonitoring()` owns the controller, aborts any prior scan, and skips poll/monitor/auto-open setup when the initial read was cancelled; `pickFolder()`/`autoReopen()` pass the signal through and clear the saved handle on cancel.
- **`index.html`** + **`sw.js`**: version markers → `2.13.0`, same commit.
- No `app-delivery` server/offline/versioning behavior changes; the version bump is the usual marker convention.

## Out of Scope

- Cancelling the file-upload loading path (`loadFiles` is fast and non-blocking) or interrupting a single in-flight file read (cooperative cancellation happens between files).
- A "run in background" / partial-results mode: cancelting stops the read entirely and clears state.
