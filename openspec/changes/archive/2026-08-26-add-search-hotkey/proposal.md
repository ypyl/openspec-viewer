## Why

The search box already has a keyboard shortcut (Ctrl+K / Cmd+K, the command-palette convention). Ctrl+P is the muscle-memory shortcut many users reach for when they want to jump to "find/quick open" — but in a browser tab it currently opens the Print dialog, which is never the intent in this app.

## What Changes

- Add **Ctrl+P** (and **Cmd+P** on macOS) as an additional keyboard shortcut that focuses and selects the search input in the header, alongside the existing Ctrl+K / Cmd+K.
- Pressing Ctrl+P SHALL suppress the browser's native Print dialog (the app never prints), so the keypress always lands the focus in search.
- The shortcut SHALL work from any state of the app; the existing Escape-to-clear behavior, query behavior, and results dropdown are unchanged.
- No replacement or removal: Ctrl+K / Cmd+K continue to work exactly as before.

**Version:** new user-facing feature (keyboard shortcut) → **MINOR, v3.13.0**. Bump must land in the same commit across the `index.html` first-line comment, the header badge (`v3.13.0`), and `sw.js` `CACHE_VERSION` (`osviewer-3.13.0`).

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `content-search`: "Search box in the app header" is updated so the search focus shortcut is provided by **both** Ctrl+P and Ctrl+K, and pressing Ctrl+P SHALL NOT open the browser's print dialog.

## Impact

- `components/osv-search/osv-search.js` — extend the existing `document` keydown listener (currently matching Ctrl+K/Cmd+K) to also match Ctrl+P/Cmd+P, with `preventDefault()` so the browser Print action never fires; focus + select the input exactly as today.
- `openspec/changes/add-search-hotkey/specs/content-search/spec.md` — delta spec for the modified requirement (MODIFIED ×1).
- Tests: no existing e2e asserts search shortcuts (verified: grep shows no ctrl-k coverage); add a `search-hotkey-test.js` e2e asserting Ctrl+P focuses the search input, suppresses the print dialog, works from an open artifact, and leaves Ctrl+K working.
- Version markers → **v3.13.0** in one commit; **no `screenshot.png` re-shoot** (a hotkey is not visual); no serving/install/dependency changes.