# Tasks

## 1. Remove the polling loop

- [x] 1.1 In `app/store.js`, delete the `pollTimers` map, the `stopTimer` helper, its call in `closeFolder`, and the `setInterval(...)` registration at the end of `startMonitoring` (keep the initial `scan` call). Verify `grep -n "setInterval\|pollTimers\|stopTimer" app/store.js` returns nothing.
- [x] 1.2 Update the `app/store.js` file header comment ("live-monitoring poll loops") and the `AGENTS.md` "Live monitoring polls every 10s" bullet to describe on-demand reads. Verify `grep -in "poll" app/store.js AGENTS.md` finds no stale claim.

## 2. Reload entry point

- [x] 2.1 Add `reloadActiveFolder()` to `app/store.js`: resolve the active folder, no-op when there is none or its kind is `upload`, register an `AbortController` in `scanAborters`, `await scan(id, true, signal, { toast: true })`, and clear the aborter in a `finally`. Verify it is exercised by the e2e test in 4.1.
- [x] 2.2 Expose `window.reloadActiveFolder` from `app/testbridge.js` alongside the existing scan helpers. Verify it is a function when evaluated in a browser session.

## 3. Header control

- [x] 3.1 In `components/osv-header/osv-header.js`, replace the `● live` badge with a reload button wired to `reloadActiveFolder()`, disabled when no folder is active or the active folder is a session-only upload. Verify by loading the app with no folder (disabled) and with a picked folder (enabled).
- [x] 3.2 Style the button in `components/osv-header/osv-header.css` (reuse the `.theme-btn` look; remove the now-unused `.live-dot` rule). Verify visually and that the console reports no errors.
- [x] 3.3 Update `README.md` so it describes the reload control instead of 10-second polling.

## 4. Version and integration

- [x] 4.1 Add `reload-test.js` (root, playwright-cli style) that opens a stubbed folder via `setInputFiles('#picker', ...)`, mutates a file, activates the reload control, and asserts the file list, diff, and unread marker update. Verify it passes against the server on `:8743`.
- [x] 4.2 Bump the version `3.21.0 → 4.0.0` in `index.html` (first-line comment), `components/osv-header/osv-header.js` (`VERSION`), and `sw.js` (`CACHE_VERSION`). Verify all three markers read `4.0.0`.
- [x] 4.3 Run `npm test` and the existing e2e tests (diff, multi-folder, archive-read, mark-all-read) against the server on `:8743` to confirm no regression from the removed timer.
