## Context

The sidebar's group collapse uses a single tiny-signals signal (`collapsed`, a `Set` of group names) backed by `localStorage` under the key `osviewer.collapsed`. On load, `app/state.js` seeds the signal with the persisted set, falling back to a first-visit default of `['Archive']` when nothing is stored. `components/osv-file-list/osv-file-list.js` reads the signal to render `collapsed` headers and writes toggles straight back to localStorage. See proposal.md - Why for motivation.

## Goals / Non-Goals

**Goals:**
- Config joins Archive in the first-visit default (collapsed).
- Keep the existing persisted per-user choice pixel-for-pixel intact (signal + localStorage, toggle handler unchanged).
- No new dependencies, no build changes (Plain Vanilla Web).

**Non-Goals:**
- Not migrating existing persisted states (see Decisions).
- Not touching the search force-open behavior, sticky Changes header, or group ordering.

## Decisions

**D1 — Change only the first-visit default.** The sole code edit is the seed value in `app/state.js`, from `['Archive']` to `['Archive', 'Config']`. Persistence (`toggleGroup`) and rendering in `osv-file-list.js` are untouched.

- *Alternatives considered:* migrating any persisted `['Archive']` to `['Archive', 'Config']`.
- *Rationale:* stored `['Archive']` is ambiguous — it could be the old default *or* a deliberate choice (collapse Archive, then toggle Config off and back on ends at `['Archive']`). Migration would override that user. The proposal asks to keep the persisted choice working exactly as Archive's does, so first-visit-only is correct and matches precedent.

**D2 — No default update on reload for existing visitors.** Only localStorage being absent triggers the new default. This is the same semantics Archive already ships, so the read path needs no "was this written by the old default" detection.

**D3 — Rely on existing search force-open.** `buildListHtml` already expands every group whenever the sidebar filter is non-empty, so a collapsed-by-default Config cannot hide search matches. No extra logic needed; the spec's "filtering reveals collapsed groups" requirement is already satisfied.

**D4 — Version is MINOR.** A visible behavior change for first-time visitors → `2.16.0`. Three markers bumped together in the same commit: the `index.html` first-line comment, `VERSION` in `components/osv-header/osv-header.js` (the header badge renders `v${VERSION}`), and `CACHE_VERSION` in `sw.js`.

## Risks / Trade-offs

- **Change invisible to the author's own browser** (they have persisted state, so the default won't re-apply) → Verification must clear localStorage (or use a fresh Playwright context), not just reload; the e2e test runs with cleared state by design.
- **Unread/config diffs hidden behind a collapsed header** (rare edits to config files) → Acceptable precedent: Archive already behaves this way, and collapsed headers still show the group count; searches still surface matches.
- **New `file-list` capability spec could be seen as over-capturing existing behavior** → Scoped strictly to group headers/collapse/persistence/filter interplay; group ordering is left to the existing content-search spec to avoid duplication.
