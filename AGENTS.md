# AGENTS.md

OpenSpec Local Viewer is a single-file static app (`index.html`) published to
GitHub Pages. Every push to `master` auto-deploys, so the version in the file is
how users tell what's live on https://ypyl.github.io/openspec-viewer/.

## Version bump rule

Bump the version in `index.html` in the **same commit** as the change:

- **MAJOR**: breaking change (layout overhaul, dropped features, incompatible data behavior)
- **MINOR**: new feature or visible behavior change
- **PATCH**: fix, tweak, or refactor with no visible change

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

## Development approach: Plain Vanilla Web

This app follows [Plain Vanilla Web](https://plainvanillaweb.com) and its ecosystem
libraries (html-literal, tiny-signals), all vendored as plain files.
**No build step, no framework, no npm**: everything is served as-is. Today the app
is a single `index.html` with classic scripts and no custom elements yet; the
sections below are the patterns to follow as it grows, not a description of the
current file. When developing, follow these principles and patterns. Source of
truth is the site itself and the jsebrech library repos; this section is the
condensed reference so work stays consistent without re-reading them.

### Philosophy

- Write plain standard HTML, CSS, and JavaScript. No build tools, no framework.
  Everything runs in the browser as-is.
- Trade short-term conveniences for long-term benefits: simplicity and effectively
  zero maintenance. Reject a dependency unless a vanilla alternative is worse.
- Prefer browser-native features before pulling in code: custom elements, shadow
  DOM, `<template>`/`<slot>`, ES modules, CSS variables, `calc()`, `color-mix()`,
  `:has()`, `scrollbar-gutter`, `dialog`, `popover`, `details`.
- Pick the app genre by interactivity: a content site is multi-file/multi-page; an
  app with rich dynamic state is an SPA. This app is an SPA (live monitoring,
  IndexedDB persistence, tabs, review state). Keep it a single page. Split files
  or extract components only when maintainability demands it; never split this app
  into a multi-page site.
- Reactivity comes from tiny-signals: app state lives in signals outside the DOM,
  and the DOM is a view rendered by `computed`/`effect`. Still "tread lightly":
  re-render only what changed; do not recreate large DOM subtrees on every state
  change or you lose selections, scroll position, and focus.

### Components (web components)

- A component is a class extending `HTMLElement`, registered once with
  `customElements.define('tag-name', Class)`.
- Tag names: lowercase, contain a dash, never self-closing. Prefix tags with a
  unique project prefix to avoid global namespace collisions.
- `connectedCallback` may fire multiple times (element is re-added/moved). Write
  it idempotently.
- Render the fixed DOM once in `connectedCallback` (or in the constructor when a
  shadow DOM is attached), then update specific nodes in place in an `update()`
  method. `update()` must tolerate being called before `connectedCallback`.
- Carry state in attributes and properties: `observedAttributes` +
  `attributeChangedCallback` for attribute-driven updates; a property setter calls
  `update()` to bring the DOM in sync.
- Pass complex data between components:
  - Events (child to parent): `dispatchEvent(new CustomEvent('x', { detail }))`.
  - Properties: recommended for stateful children.
  - Methods: recommended for stateless children.
- DOM event listeners are weakly bound; you usually do not need
  `removeEventListener` outside of app-level subscriptions (tiny-signals effects:
  those return `dispose()` and should be released).
- Define custom elements from one central place (a register function / index.js),
  not random script tags in markup.
- Shadow DOM only when you need it: isolating styles/DOM, `<slot>` placement, or
  intermediate elements between root and children. Otherwise cheap prefixed
  selectors are the better default. Shadow DOM has performance, accessibility, and
  FOUC costs; leave components in `open` mode.
- Entity-encode every interpolated HTML value (see html-literal) or you introduce
  XSS.

### Styling (modern CSS, replaces SASS/PostCSS/CSS Modules)

- Start from a CSS reset (this app vendors its own minimal one).
- System font stacks (`modernfontstacks.com`), no downloadable custom fonts.
- Structure with `@import` into a root stylesheet instead of many `<link>` tags:
  `index.css` imports reset, variables, global, then per-component CSS. HTTP/2
  downloads `@import`ed files in parallel; it is fine to use.
- Define theme/fonts as CSS custom properties in one central place; compose with
  `calc()`. This app already themes dark/light via CSS variables and uses
  `color-mix()`, `:has()`, `scrollbar-gutter`.
- Scope styles by prefixing selectors with the component tag (e.g. `x-avatar`),
  or via shadow DOM. CSS variables cross the shadow DOM boundary; custom fonts
  inside a shadow DOM must be loaded into the light DOM first.
- Use CSS nesting instead of SASS nesting; `calc()` instead of SASS operators;
  custom properties instead of SASS variables. SASS mixins have no vanilla
  equivalent yet. PostCSS is largely unnecessary on evergreen browsers (no vendor
  prefixes needed); get linting from an editor extension, not a build step.

### Sites (static pages; only the multi-file structure applies here)

- A minimal page: `<!doctype html>`, `<html lang>`, `<title>`, `<meta charset>`,
  `<meta viewport>`, stylesheet in `<head>` (blocking), `<script type="module" defer>`
  for the app bootstrap, `<noscript>` warning where web components are used.
- Use HTML landmarks and semantic elements by default; reach for native elements
  (`dialog`, `popover`, `details`) before custom elements. This app already uses
  semantic landmarks (header, aside, main).
- Project layout inspiration: `index.js`/`index.css` shared entry points, one
  folder per component (`components/name/name.js` + `name.css`), global styles in
  `styles/`, third-party libs in `lib/`.
- Dependencies: vendor prebuilt UMD/ESM files into `lib/` rather than npm.
  Load UMD off `window` (`<script src>`); import ESM directly. Centralize loads in
  an `imports.js`. Import maps are inline-only (external `importmap.json` is not
  supported everywhere).
- Deploy to any static host; this app uses GitHub Pages.

### Applications (SPA)

- SPA layout is `index.html` plus `app/*.js` views implemented as web components,
  registered in a bootstrap `index.js`. There is exactly one HTML page.
- Client-side routing is hash-based (`window.location.hash` +
  `hashchange`), and is invisible to search engines. Use it only when needed;
  most of this app's navigation is a file/change selector, not URL routes.
- Follow React's state principles for structure: group related state, avoid
  contradicting state, avoid redundant state (derive during render instead), avoid
  duplicated state, avoid deeply nested state. Lift shared state up to a common
  ancestor.
- Entity-encode via `html-literal` everywhere HTML is generated (this app renders
  all list/panes/review markup through it).

### Vendored Plain Vanilla Web libraries (jsebrech)

These are inlined (classic scripts, currently no ES module imports) so the app
still boots from `file://`. All HTML generation and reactive state must use them.

- **html-literal** (https://github.com/jsebrech/html-literal): an `html`` tagged
  template that entity-encodes interpolations by default, preventing XSS.
  - `html\`...\`` encodes values automatically (this is the default for all markup).
  - `htmlRaw(value)` opts out of encoding, for pre-sanitized HTML (e.g. the
    `DOMPurify.sanitize(marked.parse(...))` output). Use sparingly and only on
    sanitized content.
  - `htmlEncode(string)` encodes explicitly.
  - `joinHtml(array)` joins a list of `html` fragments.
  - Replaces hand-rolled `esc()` + string concatenation. Every new element/dynamic
    string must go through `html``, never raw `innerHTML += string`.
- **tiny-signals** (https://github.com/jsebrech/tiny-signals): minimal reactive
  state, the project's substitute for a framework state layer.
  - `const s = signal(initial)`; read/write via `s.value`.
  - `s.effect(fn)` runs `fn` immediately and on every change; returns `dispose()`.
  - `const c = computed(fn, [s1, s2, ...])` recomputes when a listed dependency
    changes; `c.value` reads it.
  - `s.addEventListener('change', fn)` subscribes without an initial call.
  - Used for: theme, file/change selection, search query, collapsed groups,
    highlights, recent changes. Views render from `computed` + `effect` instead of
    manual render calls.

### Local development workflow

- No build step exists. To run the app locally, serve the folder over HTTP and
  open it in a browser:
  `python -m http.server 8743` then `http://127.0.0.1:8743/`
  (alternatives: `npx serve`, VS Code Live Server).
- Localhost is a secure context, so `showDirectoryPicker`, the service worker, and
  IndexedDB all work locally exactly as on GitHub Pages.
- ES modules require an http(s) origin: they will not run from `file://`, and
  `file://` cannot register a service worker (offline works only through the SW
  cache over http). If the app ever moves to ES modules, serving over http becomes
  mandatory rather than a convenience.
- The service worker caches same-origin assets cache-first, so local edits can
  look stale after the first load. During development either tick DevTools >
  Application > Service Workers > "Bypass for network", or prefer a network-first
  policy for same-origin assets so edits appear on reload.
- The folder picker needs the File System Access API; the file-upload fallback
  is exercised in Playwright via `setInputFiles` on `#picker`.
- Live monitoring polls every 10s; changed files show a green "new" marker,
  a group counter, and a toast.

### References

- https://plainvanillaweb.com (index + pages: components, styling, sites, applications)
- html-literal / tiny-signals repos under github.com/jsebrech
- Baseline (web.dev/baseline) and Interop track which features are safe to use.
