# AGENTS.md

OpenSpec Local Viewer is a single-file static app (`index.html`) published to
GitHub Pages. Every push to `master` auto-deploys, so the version in the file is
how users tell what's live on https://ypyl.github.io/openspec-viewer/.

## Version bump rule

Bump the version in `index.html` in the **same commit** as the change:

- **MAJOR** — breaking change (layout overhaul, dropped features, incompatible data behavior)
- **MINOR** — new feature or visible behavior change
- **PATCH** — fix, tweak, or refactor with no visible change

Keep these places in sync:

1. First line: `<!-- OpenSpec Local Viewer vX.Y.Z -->`
2. Header badge: `<span class="version">vX.Y.Z</span>`
3. Service worker cache name in `sw.js`: `const CACHE_VERSION = 'osviewer-X.Y.Z'`
   (without this, returning users keep the old cached shell)

## Publishing

- Push the commit to `master`; GitHub Pages rebuilds automatically
  (allow ~1 min for the build).
- Verify after pushing: open https://ypyl.github.io/openspec-viewer/ and check
  the version badge in the header matches the latest commit.

## Development

- The whole app lives in `index.html` (HTML + CSS + JS). No build step.
- Test locally: serve the folder (`python -m http.server`) and open in Chrome.
  The folder picker needs the File System Access API; the file-upload fallback
  works in Playwright via `setInputFiles` on `#picker`.
- Live monitoring polls every 10s; changed files show a green "new" marker,
  a group counter, and a toast.