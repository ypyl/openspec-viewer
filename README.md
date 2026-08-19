# OpenSpec Local Viewer

An offline-capable, single-page viewer for [OpenSpec](https://openspec.dev/)
artifacts. It uses [Plain Vanilla Web](https://plainvanillaweb.com): no build
step, no framework — plain HTML, CSS, and ES-module JavaScript served as-is.

**Try it live:** https://ypyl.github.io/openspec-viewer/

## What it does

- Browse changes, archived changes, specs, and config from your `openspec/` folder.
- **Live monitoring** (Chrome/Edge): picks a folder via the File System Access API
  and polls every 10 seconds, so added, modified, and deleted artifacts appear
  without reloading. Open files hot-refresh in place.
- **Change diffs**: every scan snapshots artifact content, so when the monitor
  detects a change you get a **Diff** button next to the breadcrumb with +/− line
  counts — click it to switch from the artifact to a line-by-line unified diff
  view (a NEW badge marks diffs you haven't seen yet). Snapshots live in
  IndexedDB, so diffs survive a page reload.
- Open a change to see its artifacts as tabs: Proposal, Spec(s), Design, Tasks, Metadata.
- **Review mode**: select text in an artifact and add a comment; highlights are kept
  per file, then collected with the artifact content into a single LLM fix prompt
  (copy it or open it in a new tab).
- Dark and light themes, collapsible sidebar sections, and a filter box.
- Everything reads locally — nothing is uploaded.

## Using it

The app is served over HTTP(S) and loads as ES modules with a service worker, so
it must be opened in a browser rather than from `file://`. Use the hosted version
at https://ypyl.github.io/openspec-viewer/, or install it as an app (install icon
in the address bar) so it runs fully offline.

1. Click **Select Folder to Monitor** and choose your repository root or the `openspec/` folder.
2. The picker reopens at your last-chosen folder (persisted via IndexedDB).

In browsers without the File System Access API, the folder picker falls back to a
one-shot read without live updates.

## Local development

The app is a static multi-file site with no build step. Serve the folder over HTTP
and open it in a browser:

```
python -m http.server 8743
# then open http://127.0.0.1:8743/
```

## Architecture

- `index.html` — static skeleton (head meta, vendored UMD `<script>` tags,
  pre-paint theme bootstrap, component shells). Version lives in the first-line
  comment.
- `index.js` — bootstrap: registers the web components and starts the app.
- `index.css` — root stylesheet; `@import`s the stylesheets below.
- `styles/` — `reset.css`, `variables.css` (theme tokens), `global.css` (layout).
- `lib/` — vendored libraries: the Plain Vanilla Web libs (html-literal,
  tiny-signals, tiny-context) as ES modules, plus marked, js-yaml, and DOMPurify
  as UMD builds loaded off `window`.
- `app/` — logic modules: `state.js` (signals), `store.js` (IndexedDB + File
  System + snapshots/scan), `render.js`, `diff.js`, `annotations.js`, `prompt.js`.
- `components/` — web components (`osv-*`), each a folder with `.js` + `.css`.
- `imports.js` — centralizes module loads.
- `sw.js` — service worker (cache-name version tied to the app version).

Keep the version in sync across `index.html` (comment + header badge) and
`sw.js` (`CACHE_VERSION`) when you ship a change.

## Browsers / tests

- `diff-test.js` — end-to-end test of the scan → snapshot → diff → render pipeline
  (stubs the File System Access API).
- `migration-test.js` — verifies the IndexedDB v1→v2 upgrade keeps the saved folder.

Both run with `playwright-cli` against `python -m http.server 8743`.
