## Context

The sidebar renders one row per Archived change (see proposal.md — Why). Rows are derived in `components/osv-file-list/osv-file-list.js` `buildListHtml()`: for the Changes and Archive groups, change keys come from `allFiles` (itself sorted by `rel` ascending in `app/store.js`), so Archive rows today follow `changes/archive/<date>-<name>` lexicographic order — ascending by date, oldest first. Each row's label and date come from `changeMeta` (`app/state.js`), which already parses the `YYYY-MM-DD-` prefix into a `date` string via `prettyChangeName` (`app/model.js`). Undated archive directories are possible (the regex is optional), and collated `allFiles` sorting means same-date entries already appear name-ascending.

The spec (specs/file-list/spec.md — Archive changes are ordered by date, newest first) requires: dated entries newest-first, undated entries after all dated ones, and deterministic (by-name) order for same dates.

## Goals / Non-Goals

**Goals:**
- Archive rows sorted newest-first by their date prefix, undated last.
- Ordering logic pure and unit-testable, consistent with the project's model.js helper style.
- Keep behavior identical for Changes, Specs, Config groups.

**Non-Goals:**
- Re-sorting the underlying `allFiles` array or changing store scan order — display-only change.
- A sort toggle or user-configurable ordering (YAGNI; spec fixes one order).
- Changing how the Changes group orders (currently name-ascending; untouched).

## Decisions

**D1 — Sort inside the Archive branch of `buildListHtml()`, not globally.**
The Changes group must keep its existing order, so a global `keys` reorder is wrong. After building `rows` for `g === 'Archive'`, apply a stable sort with an archive comparator before rendering.

Rationale: minimal blast radius, one file touched for wiring (`osv-file-list.js`), keeps the existing loop structure.
Alternative considered: reordering keys before the `keys.map(...)` — equivalent outcome, but sorting the `changeMeta` rows is closer to what is rendered and lets the comparator work on parsed `date` directly.

**D2 — New pure comparator in `app/model.js`, unit-tested.**
Add `compareArchiveDateDesc(a, b)` (operating on `{ date }`-shaped values) next to the existing `prettyChangeName` helper. Dated entries compare by `date` descending; ISO `YYYY-MM-DD` strings compare correctly lexicographically, no Date parsing needed. An entry with an empty `date` sorts after any dated entry. Ties (same date, or both undated) keep the incoming order — the browser's `Array.prototype.sort` is stable since ES2019, and incoming row order is already name-ascending, satisfying "same-date entries by name".

Rationale: model.js is the established home for pure text/ordering helpers and has existing unit tests in `tools/` (`npm test`), so the comparator gets a free test pass.
Alternative considered: writing the comparator inline in the component — untestable without DOM/e2e, and duplicates sorting logic into markup-generation code.

**D3 — Version bump: MINOR, same commit.**
User-visible list-ordering change → MINOR per project policy, bumped together in `index.html` first-line comment, header badge (`components/osv-header/osv-header.js` VERSION), and `sw.js` CACHE_VERSION so returning users get the new shell.

## Risks / Trade-offs

- **Archive dirs without date prefix are rare, but ordering them last could surprise someone who expects alphabetical.** → Spec pins the behavior explicitly; undated entries keep their name-ascending relative order, so the tail of the list stays predictable.
- **Reliance on stable sort for same-date tie order.** → ES2019+ guarantees stability; `test-model.mjs` asserts the tie case so a regression is caught.
- **Sorting again on every list re-render.** → Trivial cost; Archive lists are small (a few dozen rows) and the comparator avoids any Date/regex work per comparison.
- **SW shell caching could serve the old list logic.** → CACHE_VERSION bump in the same commit refreshes the shell (DevTools "Bypass for network" caveat applies to local dev only).

## Migration Plan

No data or storage changes. Deploy is the existing GitHub Pages push; rollback is reverting the commit (old shell re-served after the next reload due to the versioned cache). No migrations.