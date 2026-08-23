## Context

The viewer already orders a change's tabs as the official OpenSpec review method prescribes (proposal → specs → design → tasks; see proposal.md - Why), but shows nothing of the method itself: no guiding question per artifact, no red flags, no closing checklist. The review panel (`osv-review`) is a folder-wide comment collector with a single Copy prompt action; the pane (`osv-pane`) renders change tabs and artifact content into light DOM with patch-in-place re-renders, tiny-signals state in `app/state.js`, and html-literal HTML. The app is offline-first, vendored, no build step. Requirements are in `specs/review/spec.md` (delta of the existing `review` capability).

## Goals / Non-Goals

**Goals:**
- Surface the official review method at the two moments it belongs: per-artifact guidance while reading (pane), and the closing checklist where the review concludes (review panel).
- Keep the guidance purely additive: no change to comment collection, prompt building, diff views, unread tracking, or IndexedDB.
- Stay offline-capable with no new dependencies; content bundled like the vendored libs.

**Non-Goals:**
- No persistence of checklist ticks (deferred to the review-history TODO item; session Map is the seed).
- No gating of Copy prompt; no checklist content in the copied prompt.
- No guidance for archived changes, main specs, config files, or the Metadata tab.
- No invented design-review criteria beyond what the official doc states (it gives design only one line).

## Decisions

### D1: Vendored static content module (`app/review-guide.js`)

Guide content (per-kind question + red flags, the seven checklist items, the proposal stop hint) lives in a plain ES module with a header comment recording the source URL (`github.com/Fission-AI/OpenSpec/docs/reviewing-changes.md`) and the fetch date.

- **Why**: the app is offline-first; guidance must render with no network (Requirement "Guidance renders without network access"). Fetching the doc at runtime would break the offline contract and add a dependency.
- **Alternatives considered**: bundle a markdown copy of the doc and render it — heavier and behind an expand affordance anyway; runtime fetch — rejected (offline). Distilling to question + red flags (proposal Q1) keeps the module small and the strip compact.

### D2: Two placements, two responsibilities

- **Per-tab strip in the pane**: rendered by `osv-pane` between the tab bar and the artifact body, swapped imperatively in `activateTab` (same pattern as `refreshToggle`), keyed by artifact kind derived from the rel path (`proposal.md` / `specs/…/spec.md` / `design.md` / `tasks.md`). Kinds with no guide (Metadata, archive changes, main specs, config) render no strip — same code path, null content.
- **Checklist in the review panel**: a static block above the comment list in `osv-review`, visible only while an active change's artifact is open (`currentKey` set and not an archive change). Render is a small effect over the same signals — patch in place, never touch the comment list DOM below it.

- **Why two homes**: the strip is per-file information attached to what is being read; the checklist is the change-level conclusion (proposal Q4, Q2). The tabs→strip→content stacking keeps the guidance contextual without another column.
- **Alternative considered**: checklist only, no strip — loses the per-file method; strip only — loses the closing gate. Both were chosen deliberately.

### D3: Collapsed strip, expand sticky per kind

The strip shows the guiding question on one line; expanding reveals that kind's red flags. The expand state is a `Set` of kinds in `app/state.js` (cleared on folder switch). Switching between two spec tabs keeps the spec strip expanded.

- **Why**: the question line *is* the method ("one question per file"); red flags are the deep-dive. Always-expanded would add ~6 lines of ceremony to every tab switch (proposal Q4).
- **Alternative considered**: expanded by default — rejected for noise on repeat reviews.

### D4: Checklist session state keyed by change

A session `Map` in `app/state.js`: change key → `Set` of checked indices. The review panel reads ticks for the active change key and the progress count follows. The Map is cleared on folder switch and never written to IndexedDB; reloads reset it.

- **Why**: the panel's comments are folder-wide, but the checklist is per-change; keying by change lets a reviewer bounce A → B → A without losing A's ticks, matching "session-scoped per change" (proposal Q3). It is also the seed shape for the review-history TODO.
- **Alternative considered**: single signal wiped on every change switch — rejected (lossy when comparing two changes); single signal wiped only on folder switch — rejected (cross-contamination between changes).

### D5: Guidance is content, never logic

The checklist never affects Copy prompt enabled state (that depends on comments alone) and never enters the copied prompt; no interplay with `app/prompt.js` at all. The proposal stop hint is a static sentence in the vendored content (expanded flags), not a behavioral gate — checkbox ticks are self-reported and must not drive UI state (proposal Q5, Q7).

## Risks / Trade-offs

- [Guide content drifts as the official docs evolve] → module header records source URL + fetch date; re-distill the content on the next doc change; the seven-item count in the spec is stable across the current doc version.
- [Strip steals vertical reading space] → collapsed default renders one line; flags are behind an explicit expand; no reflow churn (strip is patched in place, content below untouched).
- [Panel is folder-wide while the checklist is change-scoped] → accepted: reviewed per change, one combined prompt at the end is the existing product model; the checklist tracks the active change only.
- [Session ticks lost on reload] → accepted by spec; the review-history TODO (item 2) is the deliberate future home for persistence.
- [Design tab guidance is thin] → faithful to the doc, which specifies nothing beyond "the technical approach — only for bigger changes"; the tab only exists when design.md exists, so the caveat is self-true there.

## Migration Plan

No data migration: no IndexedDB schema change, no storage writes. Deploy is the normal static push; version markers (index.html comment, header badge, sw.js CACHE_VERSION) bump together as a MINOR as part of the change.