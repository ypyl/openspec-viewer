## Why

The app's pure logic — the diff algorithm and the path/artifact/group classifier —
has no fast, dependency-free unit coverage. Today it can only be exercised inside a
browser: `diff-test.js` runs the real app and asserts on these functions through a
`window` test bridge, and the classifier (`groupOf`, `changeOf`, `displayLabel`, …)
has no dedicated tests at all. Because the app modules read `window` globals at
import time (`imports.js` → `window.marked`/`jsyaml`/`DOMPurify`), they cannot be
imported in Node, so a plain `node --test` suite isn't possible without first
decoupling the pure core.

## What Changes

- Extract the pure, DOM-free helpers into a new `app/model.js` module (path/artifact
  classification, `prettyChangeName`, `derivePrefix`, `snippet`, `refLines`,
  `crumbFor`) that imports only from `lib/html-literal.js`.
- Make `app/diff.js` pure and Node-importable: keep `splitLines`, `diffLines`,
  `relTime`, `hunkHeader`, `diffHunksHtml`, `diffHint`, `diffTabBadgeHtml`, and change
  `diffViewHtml(rel)` / `diffToggleHtml(rel, active)` to take their data as arguments
  instead of reading `diffInfo`/`freshDiffs` from `state.js`; drop its `imports.js`
  and `state.js` dependencies (import only `lib/html-literal.js`).
- Re-point the browser modules at the extracted core (`render.js` re-exports from
  `model.js`; `state.js` imports `changeOf`/`prettyChangeName` from `model.js`;
  `osv-pane` passes `di` into `diffViewHtml`/`diffToggleHtml`). No behavior change.
- Add a `node --test` unit suite under `tools/test-*.mjs` covering the diff math and
  the path/artifact classifier, runnable with zero dependencies.
- Add a minimal `package.json` (`"type": "module"` + a `test` script) so Node runs the
  suite cleanly (this is a test runner, not a build step).
- Migrate the in-browser unit assertions out of `diff-test.js` into the Node suite,
  keeping its integration assertions (scan → snapshot → diff → render) intact.
- **Version bump to 2.0.1** (PATCH: no-visible-change refactor). All three markers
  (`index.html` comment, header badge, `sw.js CACHE_VERSION`) bump together so the
  service worker serves the changed app modules to returning users.

This is a **pure refactor + tooling** change: no externally observable app behavior
changes, so the change opts out of specs (`skip_specs: true`).

## Capabilities

No new or modified capabilities. This change does not alter app behavior — it is a
pure internal refactor (isolating a Node-importable pure core) plus test tooling.
The change's `.openspec.yaml` sets `skip_specs: true`.

## Impact

- New: `app/model.js`, `package.json`, `tools/test-diff.mjs`, `tools/test-model.mjs`.
- Modified: `app/render.js` (re-export/move helpers), `app/diff.js` (arg-driven view
  fns, pure imports), `app/state.js` (import core from `model.js`), `app/store.js`
  (import pure helpers from `model.js`), `app/testbridge.js` (import from pure
  modules), `components/osv-pane/osv-pane.js` (pass `di` into diff view fns),
  `diff-test.js` (drop in-browser unit block), and the three version markers.
- Delivery/deployment: unchanged (GitHub Pages, no build step). Node is only a test
  runtime; `package.json` does not add dependencies or affect the browser app.
- Tests: existing Playwright e2e tests (`diff-test.js`, `migration-test.js`) continue
  to cover integration; the new Node tests cover the pure logic.