## 1. Abort-capable scan loop

- [x] 1.1 Add an `AbortController` reference owned by the monitoring module (`app/store.js`): a module-level `currentScan` controller that `startMonitoring` creates for its initial scan and that any new `startMonitoring` aborts first (so a fresh pick cannot wedge behind a stale scan).
- [x] 1.2 Make `scan(initial, signal?)` accept an optional `AbortSignal`: pass it through the `walkDir` generator and the per-file processing loop, checking `signal?.aborted` each iteration (and after each `handle.getFile()`/`handleText`) and bailing out early when aborted; return an `'aborted'` status instead of throwing.
- [x] 1.3 When the scan is aborted, skip the entire state-commit block (building `fileState`/`allFiles`, the unread set, toasts, and the auto-open event) so no partial result set is presented; keep the existing `finally` clearing the loading overlay and resetting `isScanning` so a later scan can run.

## 2. Cancel semantics in start/pick/reopen

- [x] 2.1 In `startMonitoring`, pass the controller's signal to the initial `scan(true)`; after it returns, if it reports `'aborted'`, clear `dirHandle.value`, skip poll setup (`setInterval`) and auto-open, and exit — so the app returns to the pre-read (no folder) state.
- [x] 2.2 On a cancelled read, clear the persisted folder handle (the `dir` key in the `handles` store) so a reload does not re-attempt the same slow read; keep the behavior consistent for both the `pickFolder` and `autoReopen` paths.
- [x] 2.3 Confirm poll scans pass no signal (no cancel affordance for the 10s background cycle) while still satisfying the existing `isScanning` overlap guard.

## 3. Cancel UI in the loading overlay

- [x] 3.1 Extend `setLoading(msg, action?)` so callers can pass a `{ cancel: fn }` action; extend `osv-loading` to render a Cancel `<button>` beside the spinner/message only when a cancel action is supplied (upload/other loading keeps today's button-less overlay).
- [x] 3.2 Wire the Cancel button and an `Escape` key handler to invoke the cancel action and clear the overlay; give the overlay dialog semantics (`role="dialog"`, `aria-modal`) only while a cancel button is shown and make the button keyboard-accessible (focusable, Enter/Space).
- [x] 3.3 Have the initial folder read in `startMonitoring` pass a cancel action that aborts the scan (via `currentScan.abort()`), so the overlay's Cancel button and `Escape` both stop the read.

## 4. Version bump (user-visible)

- [x] 4.1 Bump the version to **v2.13.0** across all three markers in the same commit as this user-visible change: `index.html` first-line comment, header badge, and `sw.js` CACHE_VERSION.

## 5. Verification

- [x] 5.1 Manually verify the spec scenarios against `python -m http.server 8743`: with a folder whose read is slow enough to observe, the Cancel control is visible; clicking it (and separately pressing `Escape`) stops the read, dismisses the overlay, leaves the app in the pre-read state without a partial file list, and no live monitoring starts afterward; opening a folder again (and reloading after a fresh pick) works normally.
- [x] 5.2 Run the existing Playwright e2e suites (`diff-test.js`, `migration-test.js`) via playwright-cli against the local server and report results.
- [x] 5.3 Push to `master` and confirm the GitHub Pages deploy shows the v2.13.0 badge and refreshes assets (service worker cache updated).
