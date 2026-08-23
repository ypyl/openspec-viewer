## 1. Guide content module

- [x] 1.1 Create `app/review-guide.js`: a plain ES module exporting `GUIDE` (per artifact kind: `proposal`, `spec`, `design`, `tasks` — each `{ question, flags: [...] }`) and `CHECKLIST` (the seven two-minute items in the official order, design D1). Proposal flags include the doc's stop hint ("if the proposal is wrong, stop and fix it before reading further"); design carries only the doc's own line (the technical approach — only for bigger changes) with no invented criteria. Header comment records the source URL (`github.com/Fission-AI/OpenSpec/docs/reviewing-changes.md`) and fetch date.
- [x] 1.2 Import `GUIDE`/`CHECKLIST` in `osv-pane` and `osv-review` as a normal app module (like `app/render.js`); no new vendored lib, no change to `index.html` script tags or `imports.js`.

## 2. Pane guidance strip

- [x] 2.1 In `app/state.js` add `expandedStripKinds` (a `Set` of guide kinds, design D3) and `checklistTicks` (a `Map` of change key → `Set` of checked indices, design D4), both cleared on folder switch with the rest of the per-folder session state; never persisted to IndexedDB.
- [x] 2.2 In `osv-pane`'s `openChange` template, add a strip container between the tab bar and `.pane-body`, rendered only for active (non-archive) changes; archive changes get no strip (spec "No strip for archived changes or main specs").
- [x] 2.3 In `activateTab`, derive the guide kind from the rel path (`proposal.md` / `specs/…/spec.md` / `design.md` / `tasks.md`; null for the metadata tab) and patch the strip in place: collapsed shows the kind's guiding question, expanded (kind present in `expandedStripKinds`) also shows its red flags; no strip when the kind is null. Wire the toggle click to add/remove the kind and re-render the strip only.
- [x] 2.4 Add strip styles scoped to the component in `components/osv-pane/osv-pane.css`: single-line collapsed state, expand chevron, flag list indented under the expand, no layout jank when the strip swaps (content below untouched).

## 3. Review panel checklist

- [x] 3.1 In `osv-review`, render a checklist block above `.review-list`: the seven `CHECKLIST` items as checkboxes plus a progress count ("n of 7"), shown only while an active change's artifact is open (`currentKey` set and not an archive change) and absent for standalone artifacts, main specs, and archived changes (spec "No checklist outside a change").
- [x] 3.2 Back the checkboxes with `checklistTicks` keyed by the active change key: clicking toggles that change's tick set and the effect patches just the progress text and checkbox states in place (never re-render the comment list below). Switching changes swaps which change's ticks are shown (tick state per change remembered; spec "Ticks survive switching between changes").
- [x] 3.3 Add checklist styles in `components/osv-review/osv-review.css` scoped to the component, compact enough not to push comments out of reach.

## 4. Version bump and verification

- [x] 4.1 Bump version markers together to the next MINOR: `index.html` first-line comment, header badge (`osv-header.js` VERSION), and `sw.js` CACHE_VERSION.
- [x] 4.2 Verify end-to-end with playwright-cli against `python -m http.server 8743` using a fixture folder with a change: strip shows on Proposal/Spec(s)/Design/Tasks tabs with the right question per kind, absent on the Metadata tab, on an archived change, on a main spec, and on `config.yaml`; expand reveals flags and stays expanded across two spec tabs; checklist shows 7 items + progress on a change, ticks survive A→B→A switching and clear after reload; Copy prompt stays disabled with zero comments regardless of checklist state, and with comments it copies a prompt containing no checklist content.

# Open Questions

None — all decisions resolved during exploration (recorded in proposal.md / design.md D1–D5).