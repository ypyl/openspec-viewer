## Why

The OpenSpec project publishes an official review method (`docs/reviewing-changes.md`): read a change's artifacts in order (proposal → spec deltas → design → tasks), answer one guiding question per file, look for each file type's red flags, then pass a seven-item checklist before applying. The viewer already orders a change's tabs exactly that way — but it shows none of the method itself. Users reviewing a change are left with the raw artifacts and no guidance, so the review pass the docs promise (the cheap catch of a wrong turn while it is still words) happens mostly by luck.

## What Changes

- **Per-tab guidance strip in the content pane** (active changes only). A compact strip between the tabs and the artifact body shows the guiding question for the opened artifact kind (proposal, spec delta, design, tasks) — "Does this match what I asked for?" for a proposal, and so on. Expanding it reveals that kind's review red flags (e.g. scope creep, vague requirements, tasks with no matching requirement). For the proposal, the expanded flags include the official "stop and fix the proposal first" hint.
- **The two-minute checklist in the review panel** (active changes only). A seven-item checklist from the official doc ("proposal's intent matches what I asked for", "nothing extra crept into scope", "every requirement is testable", "every requirement has a scenario that exercises it", "the case I care about most is covered", "tasks map to requirements", "I'd trust exactly this and nothing more") rendered at the top of the review panel as interactive checkboxes with a running progress count.
- **Session-scoped checklist state, keyed per change.** Ticks persist while browsing within the session (switching changes remembers each change's own ticks; switching back restores them). They are cleared on folder switch and page reload. Checklist results are **not** persisted to IndexedDB (future review-history work), are **not** included in the copied LLM prompt, and **never** block or gate the Copy prompt action — the checklist is guidance for the human reviewer, not a gate.
- **Static vendored guide content.** The questions, red flags, and checklist are distilled from the official OpenSpec docs into a new static module (`app/review-guide.js`), with the source URL and fetch date recorded in the module header. No network access, no new dependencies; the app stays offline-capable and unchanged in how it is served.
- **Guidance scope.** The strip appears only on the tabs of an active change's artifacts (Proposal, Spec(s), Design, Tasks). It does not appear for the Metadata tab, for archived changes, for main specs, or for config files. The Design tab shows only the doc's own one-liner (the technical approach — only for bigger changes), since the official doc gives design no further criteria.

## Capabilities

### New Capabilities

- none

### Modified Capabilities

- `review`: The review capability gains an in-pane guidance strip for change-artifact tabs and a change-scoped, session-persistent two-minute checklist rendered in the review panel; both draw from vendored guidance content. No review-panel comment, prompt, or highlight behavior changes.

## Impact

- **New code**: `app/review-guide.js` (static vendored content: per-kind question + red flags + the seven checklist items); session state for checklist ticks and the strip's expand state in `app/state.js`.
- **Changed components**: `components/osv-pane` (render + swap the guidance strip as tabs activate, below the tabs); `components/osv-review` (render the checklist block above the comment list, backed by the session state). Both render statically or via existing tiny-signal patterns — no changes to diff views, highlights, the prompt builder, or IndexedDB.
- **No new dependencies, no build step, no serving/install changes** (content is bundled, offline-capable; the app-delivery capability is unaffected).
- **Version**: MINOR bump (new visible feature) across the three markers (index.html comment, header badge, sw.js CACHE_VERSION).