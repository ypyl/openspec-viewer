## Context

See proposal.md - Why for motivation. Current state: a single `index.html` (2,692 lines) containing ~960 lines of inline CSS, three CDN scripts (marked, js-yaml, DOMPurify), inlined vendored PV libs (html-literal, tiny-signals, tiny-context) exposed as `window.PV`, and one ~1,550-line app script. State is already signal-based; rendering is full-subtree `innerHTML` swaps via `computed`/`effect`; event handling is one large click delegation on `contentEl`; annotations wrap text nodes of rendered markdown (render-then-annotate). Serving model is GitHub Pages + service worker (navigation network-first, assets cache-first). Constraints: no build step, no framework, Plain Vanilla Web per AGENTS.md, single-page SPA, version markers in sync (HTML comment, header badge, SW cache name).

## Goals / Non-Goals

**Goals:**

- Multi-file PVW application structure: `index.html` skeleton, `index.js` bootstrap, `index.css` with `@import`s, `styles/`, `lib/`, `app/` logic modules, per-component `components/osv-*/` folders.
- All UI regions become custom elements (`osv-*`), registered centrally in the bootstrap.
- ES modules via a single `<script type="module">` entry; `imports.js` centralizes module loads; UMD libraries load off `window`.
- Patch-in-place rendering in the stateful components (file list, pane) so scroll, focus, and selection survive unrelated state changes.
- Annotation contract: `osv-pane` renders into light DOM and exposes an `onRendered` hook; the annotation module re-applies highlights per render.
- State as an exported `app/state.js` signals module, imported directly by components.
- Vendored libraries in `lib/`; no CDN at runtime.
- Version 2.0.0 (MAJOR: file:// dropped, structure overhaul) with all three markers bumped in the same commit.

**Non-Goals:**

- Wiring tiny-context for cross-component state (stays vendored but dormant; see Decision: State passing).
- Moving to a multi-page site (SPA stays).
- Adding a build step, bundler, or TypeScript.
- Server-side rendering or URL routing.
- Changing feature behavior (browsing, monitoring, diffs, review/annotations) beyond what the structure forces.
- Preserving `file://` support.

## Decisions

### Decision: ES modules over classic scripts, accepting the file:// drop

Split into files and load via `<script type="module">` per AGENTS.md. ES modules require an HTTP(S) origin, so `file://` support is intentionally dropped and the README install story rewritten. Alternatives considered: (a) classic `<script>` tags split into files — preserves `file://` but contradicts AGENTS.md's ES-module pattern and gains nothing else; (b) build tooling — rejected outright by the no-build constraint. Accepted tradeoff: the SW already required HTTP anyway, so the hosted + PWA paths were already the primary distribution.

### Decision: Component boundaries by stateful region

Seven components, each owning its DOM and events:

```
components/
  osv-header/          title, version badge, theme button, stats, review button
  osv-file-list/       pick button, search, group sections, items (patch-in-place)
  osv-pane/            tabs, crumb + diff toggle, artifact/diff body (patch-in-place)
  osv-review/          review drawer: comment list, copy/send actions
  osv-prompt-modal/    LLM prompt modal
  osv-loading/         loading overlay
  osv-toast/           transient toasts
```

Everything else (data access, diff math, annotations, markdown rendering helpers) stays as plain modules under `app/` — components are where DOM ownership belongs, modules are where logic belongs. The single big `contentEl` click delegation dissolves: each component binds its own events in `connectedCallback` and dispatches `CustomEvent`s upward.

### Decision: State passing via a signals module, tiny-context stays dormant

`app/state.js` exports the existing signals (`theme`, `allFiles`, `currentRel`, `currentKey`, `search`, `collapsed`, `highlights`, `recentRels`, `changeMeta`, `diffViews`, `diffInfo`, `dirHandle`, …); components import and mutate them directly. Rationale: the app is one page, one app, one flat layout — there is no tree-scoped state that needs injection, and no component will ever be reused outside this app. tiny-context adds dispatch boilerplate and a class of "no provider" silent bugs for zero benefit here. Deliberate deviation from AGENTS.md's "wire it in when UI is extracted into custom elements"; recorded so the choice is conscious and reversible if a real tree-scoped need appears.

### Decision: Light-DOM pane with an explicit annotation hook

`osv-pane` renders its artifact/diff body into light DOM (no shadow root) so `document.getSelection()` ranges traverse text nodes normally — the annotation module wraps highlighted text in `<mark>` elements after render, and the highlight bubble and comment flow stay as-is. The pane exposes an `onRendered` hook (a simple callback invoked after each render/update) that the annotation module subscribes to, replacing today's implicit render-then-`applyHighlights` sequencing. Rationale: shadow DOM would break selection/highlighting at the boundary (selections do not cross shadow roots) and buy only style isolation the rest of the app does not need. Per AGENTS.md, other components also stay in light DOM with prefixed selectors.

### Decision: Rendering strategy — patch in place, re-render only on structural change

Stateful components update specific nodes in their `update()` methods instead of swapping the whole subtree. The file list re-renders items only when the underlying data changes shape (and preserves `scrollTop` across non-structural updates); the pane re-renders only its body region. Rationale: AGENTS.md explicitly warns that recreating large DOM subtrees loses selections, scroll position, and focus — the current full-`innerHTML` swaps are exactly that bug today. Light data (`diffHint`, badges, counters) update by targeted text/node mutation.

### Decision: Vendored libraries in lib/, CDN removed

`lib/` contains the three PVW libraries (html-literal, tiny-signals, tiny-context) as ESM plus marked, js-yaml, and DOMPurify as vendored prebuilt UMD files loaded off `window` via `imports.js` (AGENTS.md: "Load UMD off window; import ESM directly"). All three CDN `<script>` tags are removed; the SW precaches the whole graph so offline works with zero external fetches.

### Decision: Service worker precaches the full graph

`SHELL` becomes the complete asset list (HTML, manifest, icons, `index.js`, `imports.js`, all `app/*` and `components/*` modules and styles, `lib/*`, `styles/*`). Naviation stays network-first, assets cache-first; `CACHE_VERSION` → `osviewer-2.0.0` in the same commit as the 2.0.0 version markers.

## Risks / Trade-offs

- Annotation seam breaks during componentization (render timing, mark re-application) → Define the `onRendered` contract first, port annotations last against a working pane, and exercise the highlight flow manually before pushing.
- Module fetch races with SW cache (users served stale module file mid-release) → Versioned cache name per release guarantees a fresh install and cache swap; navigation network-first already delivers the new shell immediately.
- Scroll/focus regressions in the file list during the patch-in-place conversion → Preserve `scrollTop` and active-element explicitly in `update()`; verify with the Playwright flow that previously exercised list rendering.
- Playwright tests break against the new boot sequence → Update `diff-test.js`/`migration-test.js` in the same change and run them against `python -m http.server 8743` before pushing.
- Removing CDN bloat vs repo weight → Vendored minified builds add ~200 KB to the repo; acceptable for zero network dependency and airtight offline.
- `file://` users are left behind silently → README + the in-page error message (per spec: clear message when opened from `file://`) explain the requirement.

## Migration Plan

Land as one commit on `master` (GitHub Pages rebuilds automatically). The navigation network-first policy means returning visitors fetch the new `index.html` immediately; the new `CACHE_VERSION` discards the old cache. Rollback is a revert of the single commit. Before pushing: run `diff-test.js` and `migration-test.js` against a local server and do a manual pass over theme, monitoring, diff, and review/annotation flows.

## Open Questions

None — the decisions above resolve the open questions from exploration (distribution, scope, annotation contract, state passing).