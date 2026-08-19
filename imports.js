// Centralized module loads (see AGENTS.md). Every app module that needs a
// library imports it from here instead of reaching for a global or CDN.
//
// The UMD libraries (marked, js-yaml, DOMPurify) are loaded as classic
// <script src> tags in index.html (vendored in lib/) and populate window
// globals; we re-export those globals so the rest of the app imports them as
// ES module bindings. The Plain Vanilla Web libs are real ESM files.

export { html, htmlRaw, htmlEncode, joinHtml, Html } from './lib/html-literal.js';
export { signal, computed } from './lib/tiny-signals.js';
export { ContextProvider, ContextRequestEvent } from './lib/tiny-context.js';

// UMD globals (set by the classic script tags in index.html).
export const marked = window.marked;
export const jsyaml = window.jsyaml;
export const DOMPurify = window.DOMPurify;
