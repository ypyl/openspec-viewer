## Context

See proposal.md - Why. Current state: the app runs in the browser as ES modules with
all library loading centralized in `imports.js`, which reads the UMD globals
(`window.marked`, `window.jsyaml`, `window.DOMPurify`) at module-evaluation time.
Consequently every `app/*` module that (transitively) imports `imports.js` fails to
load in Node (`window is not defined`), so the pure logic cannot be unit-tested
without a browser. The only tests today are two Playwright browser e2e suites
(`diff-test.js`, `migration-test.js`).

## Goals / Non-Goals

**Goals:**

- Make the pure, DOM-free logic (diff math; path/artifact/group classifier) importable
  in a plain Node runtime with zero dependencies.
- Add a small `node --test` suite (`tools/test-*.mjs`) covering that pure core.
- Keep the browser app behavior and its public module surface unchanged (refactor-only).
- Keep the Playwright e2e tests for integration/DOM behavior.

**Non-Goals:**

- Unit-testing DOM/IndexedDB/FS/Access-bounded code (`state.js` mutation, `store.js`
  scan/snapshot, `annotations.js` selection/wrapping, renderers needing marked/DOMPurify).
  Those stay covered by e2e.
- Testing `buildPrompt` in isolation this change (it is tangled with state + annotations
  and already exercised by the review e2e flow); out of scope unless it becomes cheap.
- A build step, bundler, coverage thresholds, or CI wiring. Node is a test runtime only.

## Decisions

### Decision: Extract a Node-safe pure core into `app/model.js`

Move the classification/text helpers out of `render.js` into a new `app/model.js`
that imports only from `lib/html-literal.js` (Node-safe): `normPath`, `artifactOf`,
`isRelevant`, `isArchived`, `groupOf`, `displayLabel`, `changeOf`, `prettyChangeName`,
`derivePrefix`, `snippet`, `refLines`, `crumbFor`. `render.js` keeps the renderers
(`markdownPane`, `yamlPane`, `metaCard`, `parseFrontmatter`, `handleText`) that need
marked/jsyaml/DOMPurify and re-exports the moved helpers so existing importers
(`state.js`, `store.js`, components) keep working unchanged. Rationale: isolates the
browser I/O from the pure logic; the wall in `imports.js` only affects the renderers.
Alternative (shimming `window` in Node) was rejected as brittle — it would drag the
UMD/DOMPurify build into the test runtime and test untested globals.

### Decision: Make `app/diff.js` pure and argument-driven

`diff.js` today reads `diffInfo`/`freshDiffs` from `state.js` only inside
`diffViewHtml(rel)` and `diffToggleHtml(rel, active)`, and imports `html`/`joinHtml`
from `imports.js`. Change those two functions to take their data as arguments
(`diffViewHtml(di)`, `diffToggleHtml(rel, di, fresh)`) and switch `diff.js` to import
`html`/`joinHtml` from `lib/html-literal.js` directly (no `state.js`, no `imports.js`).
The only caller (`osv-pane`) already has `diffInfo.get(rel)` and `freshDiffs` handy, so
it passes them in — no behavior change. Rationale: makes the subtle LCS/hunk logic
fully importable in Node with the smallest surface change.

### Decision: Import pure modules directly from `lib/`, not `imports.js`

`app/model.js` and `app/diff.js` import from `../lib/html-literal.js` rather than
through `imports.js`. This deliberately bends the "centralize loads in `imports.js`"
convention, because `imports.js` is itself browser-bound by the UMD globals it re-exports.
Documented trade-off; `imports.js` still centralizes the browser-facing surface.

### Decision: A minimal `package.json` (test runner only)

Add `package.json` with `"type": "module"` (so Node treats `app/*.js` as ESM without
reparse warnings) and a `test` script: `node --test "tools/test-*.mjs"`. No
`dependencies`/`devDependencies`. This is a test harness, not a build step; the browser
app and deployment are unaffected (the vendored UMD libs still load via `<script>`).

## Risks / Trade-offs

- Moving helpers out of `render.js` could break an import path → Mitigation: keep the
  public surface via re-export; the Playwright e2e suites (`diff-test.js`,
  `migration-test.js`) act as a regression net and must pass after the refactor.
- Changing `diffViewHtml`/`diffToggleHtml` signatures could miss a caller → Mitigation:
  only `osv-pane` calls them; update it in the same change and re-run e2e.
- Returning users served stale app modules (SW cache-first) after the file changes →
  Mitigation: bump `CACHE_VERSION` to `osviewer-2.0.1` in the same commit (PATCH).
- `node --test` availability → Node ≥ 18 has it built in (no dep); document the Node
  requirement in the test header.

## Migration Plan

Land as one commit on `master`; GitHub Pages rebuilds (no visible change, but version
badge → 2.0.1). Verify `node --test tools/test-*.mjs` passes, then the two Playwright
e2e suites still pass against `python -m http.server 8743`. Rollback is a commit
revert.

## Open Questions

None.