## Context

Today the app monitors exactly one folder: a single `dirHandle`, one flat
`allFiles` array, one `Map` of snapshots in IndexedDB keyed by relative path,
one poll timer, one read-state set. Every component reads the shared view
signals (`allFiles`, `currentRel`, `currentKey`, `recentRels`, `highlights`…)
and several non-reactive maps (`paneCache`, `fileState`, `diffInfo`,
`diffViews`). See proposal.md — Why for motivation; the spec deltas in
`specs/` are the behavior contract this design implements.

The change must generalize that model to N folders without a large
component-by-component rewrite, preserve the no-build Plain Vanilla Web setup,
keep IndexedDB data for existing users, and keep one poll loop per folder.

## Goals / Non-Goals

**Goals:**
- One narrow rail component + a name/close row, added without touching every
  existing component's render path.
- All per-folder data keyed by a stable folder id (never by display name).
- Existing users' handle, snapshots, read state, and review items survive the
  IndexedDB v2→v3 migration.
- Background folders keep monitoring and report changes with their name.

**Non-Goals:**
- One rail entry spanning multiple openspec roots (monorepo roots are separate
  entries; each scans its own subtree).
- Drag reordering of the rail, renaming projects in place, undo-close, or a
  folder count cap.
- Cross-folder diffs or a combined search index.

## Decisions

### D1. Folder registry + projected view signals (state model)

Keep the existing view signals (`allFiles`, `currentRel`, `currentKey`,
`recentRels`, `highlights`, `searchMarks`, `searchVersion`) as the *active
folder's projected view*, and move all authoritative per-folder data into a
registry: `Map<folderId, folderState>` where `folderState` holds files,
unread set, selection, caches, and the non-reactive maps (`paneCache`,
`fileState`, `diffInfo`, `diffViews`). Switching the active folder swaps the
projected signals and the exported maps from `folderState[old]` →
`folderState[new]` in one effect; components keep reading exactly the symbols
they already import.

**Why:** the gated cost of nesting every signal was a mechanical refactor of
every component + every `computed` (allFiles spans 6 modules, highlights 8).
Projection concentrates the change in `app/state.js` + `app/store.js` and one
new component, preserving the patch-in-place re-render contract.

**Alternatives considered:**
- *Full nested state* (`allFiles` becomes `Map<id, signal>`): most honest
  model, but touches every render path and every computed — larger blast
  radius and more regression risk for no user-visible gain.
- *Swap-in/swap-out* (serialize active folder into the registry on switch):
  creates two homes for the same folder's state and breaks background scans,
  which need a single authoritative write target.

**Drift risk & containment:** the classic projection trap is two copies of a
value going out of sync. Containment rules: scans write **only** into
`folderState[id]`, then mirror to the projected signals when that folder is
active; selection (`osv:select-rel`/`osv:select-change`) and pane-cache writes
go through write-through helpers that update `folderState[active]` and the
projected symbols together; the active-folder effect is the only place that
reassigns the projected sets wholesale.

### D2. Stable folder id; name is display-only

Each folder gets `crypto.randomUUID()` persisted in the IDB folder registry.
Project name = the picked entry's `name` (last path segment), re-derived on
each session; never a key. Hue = hash of the name → CSS hue; display suffix
`#2`/`#3` computed on name-collision at add time and again on reload.

**Why:** snapshot keys and per-folder localStorage keys must survive the user
renaming a directory on disk; a stable uuid does, a name does not.
`isSameEntry` (on the resolved openspec roots) detects "same folder picked
again" so adding never duplicates; uploads have no `isSameEntry`, so they
dedup by normalized rel-path set.

### D3. IndexedDB v2→v3: folder registry + composite snapshot keys

- New `folders` store, keyPath `id`: `{ id, name, pickedHandle, rootHandle,
  kind: 'pick'|'upload' }`. Upload entries are never written here.
- `snapshots` store re-keyed to composite strings `id + '/' + rel` (record
  gains `folderId` too, for the search corpus builder to filter by folder).
- `onupgradeneeded` (v2→v3) migrates in the upgrade transaction: read the old
  `'dir'` handle, mint one legacy folder id, write the folder row, then
  cursor through every snapshot row and re-key it under the legacy id.
- Legacy review items: re-key `osviewer.highlights` (rel-keyed) into
  `osviewer.highlights.<legacyFolderId>` on first load; per-folder view state
  uses `osviewer.collapsed.<id>`.
- Any migration failure degrades gracefully: no persisted folders, no crash —
  storage operations are already non-fatal in the app.

**Why:** one upgrade transaction keeps the old handle and snapshots atomic
with their re-keying, so existing users keep diff baselines and read state.
Keying by folder id also fixes the pre-existing collision bug where two
folders holding the same rel path would share one snapshot row.

### D4. Per-folder monitoring; one poll loop per folder

`scan()` becomes `scan(folderId, initial, signal)` working purely against
`folderState[id]` (its own `fileState`, `recentRels`, baseline, snapshots).
Timers live in a `Map<folderId, interval>`; `isScanning`/`currentScan`
(AbortController)/`baselineFresh` become per-folder too. After a scan,
mirror to the projected signals if `folderId` is active.

Notices: an aggregate of a scan affecting a non-active folder prefixes the
toast (`llmclip: 3 artifacts updated`) and marks the folder's avatar dot;
active-folder scans keep today's wording. On reload, `autoReopen` iterates
granted entries, starts each, then shows one aggregated notice listing
folders with changes since last visit and any that were skipped for revoked
permission.

### D5. Rail component + name/close row

New `components/osv-folder-rail/` (osv-folder-rail.js + .css): fixed ~60px
icon column, `+` action at top (falls back to the webkitdirectory upload),
avatar buttons (first letter, hue, unread dot, hover × tooltip), active
highlight, session-only hollow ring for uploads; patch-in-place rendering
from a `computed` over the folder list signal. The name + close row lives at
the top of `osv-file-list`'s controls (replacing the pick button), showing
the active folder's ellipsized name + square close. Mobile: rail becomes a
horizontal strip; the name row stacks with search.

**Why:** the rail is self-contained navigation and can render from a reactive
folder-list signal; the name row belongs where the old pick button was,
keeping the file list's DOM shape stable (`tread lightly`).

### D6. Prompt paths per folder

`storePrefix` stays a module value but is set per active folder and on
switch: single folder → `openspec/` (unchanged history); N folders → `name +
'/openspec/'`. The prompt builder needs no other change.

## Risks / Trade-offs

- [Projection drift: a scan, selection click, or cache write misses the mirror
  and components render stale data] → single write path through
  `folderState[id]` + write-through helpers; the active-folder effect is the
  only wholesale reassigner; verified by the multi-folder e2e story.
- [Migration bug orphans an existing user's snapshots/read state] → migration
  runs in one IDB upgrade transaction (handle + re-key are atomic); on any
  error the app boots with no persisted folders rather than corrupted ones —
  baseline resets, markers recompute, nothing crashes.
- [Many folders → many poll timers and initial scans on reload] → each poll is
  a stat-walk over a small openspec subtree (content is read only when
  mtimes differ); reload scans run once and are cancellable per folder; no cap
  per spec, but boot cost is linear in folder count.
- [Background toasts get noisy with several active projects] → non-active
  notices are aggregated into one toast per scan pass; the avatar dot is the
  persistent signal, the toast is transient.

## Migration Plan

1. Ship as 3.0.0 (version markers: index.html comment + header badge +
   sw.js CACHE_VERSION, in the same commit).
2. First load after upgrade runs the IDB v2→v3 upgrade (folder registry +
   snapshot re-key) and the localStorage re-key of highlights → legacy folder.
3. Rollback: not supported at the data level (v2 is rewritten); the app
   degrades gracefully on migration failure, and closing/re-picking a folder
   rebuilds state from scratch. No external systems or server moves involved.

## Open Questions

None that affect the specs, approach, or task breakdown.