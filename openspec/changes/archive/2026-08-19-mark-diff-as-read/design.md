# Design: Mark diff (changes) as read

## Context

The app detects changes three ways and tracks "unseen" state in memory only. `recentRels` (a `Set` of rels changed-since-last-scan, not yet opened) drives the green dot, `.new` row class, and group counters; `freshDiffs` (a `Set` of rels whose diff wasn't viewed) drives the "NEW" badge on the Diff toggle. Both reset on reload, and the first scan re-flags everything that differs from the persisted snapshot — so reviewed changes resurface as new. Content snapshots live in IndexedDB (`snapshots` store, keyPath `rel`, row `{ rel, text, mtime }`); that store is versioned and covered by `migration-test.js`. See proposal.md — Why for motivation; specs/change-monitoring/spec.md for the behavior contract.

## Goals / Non-Goals

**Goals:**
- Persist per-artifact read state so reviewed changes stay reviewed across reloads.
- Key read state to the exact content version, so a later edit re-flags the artifact as unread.
- Acknowledge artifacts individually (no blanket clear when a change opens).
- Reuse the existing snapshot storage with no database schema migration.

**Non-Goals:**
- A "mark all as read" control (out of scope; see Open Questions).
- Folder-scoped read keys for multi-folder monitoring (matches the existing rel-keyed snapshot scheme; re-visit when multi-folder lands).
- Any change to serving, offline, install, or dependencies.

## Decisions

### D1: Read state is a version pointer, stored inside the snapshot row

Each snapshot row gains two fields: `readHash` (a fingerprint of the text version the user last acknowledged) and `unread` (a boolean, whether the artifact currently has an unacknowledged change). There is no separate `reads` store.

*Why over a separate store:* extending an existing value-shaped row is data, not schema — the `snapshots` store keeps its `keyPath: rel`, so the IndexedDB version stays `2` and `migration-test.js` passes unchanged. Read state also shares the snapshot's lifecycle: switching folders or deleting a file clears both together, so read state cannot leak across projects or outlive a deleted artifact. Alternative considered (a new `reads` store) required an IDB version bump `2 → 3`, a migration test update, and a second lookup per scan, for cleaner separation that this app doesn't need.

*Upgrade semantics:* existing rows have neither field (`undefined`). A rel is only examined when it is modified, so upgrading users are not re-flagged: files whose content still matches their snapshot keep `unread` absent (not flagged); files that change *after* the upgrade get flagged once (their `readHash`/`unread` are absent) and clear on acknowledgment. Nothing the user already reviewed is re-flagged. No data migration code required.

### D2: Unread is derived from the scan, keyed by content hash

`unread(rel)` is decided during `scan()` for each modified file:

- no prior snapshot → brand-new file → unread (the whole file is the change; no diff view exists yet)
- `snap.readHash !== hash(text)` → changed since last acknowledgment → unread
- `snap.readHash === hash(text)` → already acknowledged → read

Unmodified files are never examined — if their text matched the read pointer last scan and nothing changed, they are still read. This makes reload persistence fall out for free: on reload the first scan compares persisted `readHash` against current text, so read files stay read and unread files stay unread.

The `unread` boolean is needed because `readHash` alone cannot carry an unread state across a reload once the snapshot has already advanced. If a file changes and is scanned (snapshot overwritten to the new version) without being read, the persisted row then has `text == current` and a stale/absent `readHash` — indistinguishable from an unchanged-never-read file. The persisted `unread` flag carries that unacknowledged change across reloads; `readHash` continues to drive re-flagging when content differs from the acknowledged version (e.g. a read file edited while offline).

*Latest-change-only, no history:* this design never stores a change history. Each rel keeps exactly one snapshot (overwritten every scan), one `diffInfo` entry, and one binary unread flag, so the system always surfaces the most recent change. If a file changes twice before being read, the diffs from the intermediate state are already gone (the snapshot was overwritten) and only the latest change is shown under a single unread flag. This matches the spec's "Surface only the most recent change" requirement and deliberately avoids any change-count or history structure.

*Why a content hash, not the snapshot's `mtime` or a timestamp:* mtime-only touches would re-flag a file that changed nothing; a timestamp cannot survive reload because `diffInfo` (and its `ts`) is rebuilt each session, so any persisted timestamp would always be older than a freshly rebuilt diff and wrongly re-flag everything. The content hash is version-exact and reload-proof.

Hash choice: a tiny zero-dependency hash (e.g. cyrb53, ~5 lines) over the normalized text, computed once per modified file at scan time. Collisions are a negligible concern at this scale.

### D3: `diffInfo` carries the new-text hash it was computed from

`diffLines` returns `{ hunks, added, removed, ts }`; it additionally carries `hash` of the *new* text (the side the user acknowledges). Marking read writes exactly this value, so the write is synchronous with what was diffed and immune to a race if the file changes again while the diff is open.

### D4: Acknowledgment happens at render seams, under the "seen everything" rule

Answering the open question resolved in planning (see proposal/spec): a file is read only when the user has seen everything there is to see.

- Opening the **Diff view** (the toggle handler in the pane) → always acknowledge.
- Opening an **artifact view** (`openFile`/`activateTab`) → acknowledge only when `diffInfo` has no entry for that rel (nothing more to review). A brand-new file has no baseline, hence no diff, so its content view is the whole change and acknowledges it.

This rule can never self-clear on live refresh: when a read file is edited while its artifact view is open, the scan sets a diff and `osv:refresh-current` re-renders — at that point the "diff exists → don't acknowledge" branch fires, so the edit re-flags instead of silently acknowledging.

The current `clearRecentForMeta` (blanket-clear on opening a change) is removed; acknowledgment flows only through the render seams above, giving per-artifact granularity.

Count labels (`diffTabBadgeHtml` on change tabs, `diffHint` in the file list) mirror this: they show only for rels still in the unread set. Reading a diff drops the artifact's `+a −r` badge from its tab and excludes it from the file-list change-row hint (which sums only unread files). Tab badges are imperative DOM, so `markRead` refreshes them; the list updates via `recentRels` reactivity.

### D5: `recentRels` becomes the reactive unread set; `freshDiffs` folds into it

`recentRels` keeps driving the list markers/counters (green dot, `.new`, group counts) but its meaning changes to "rels with unacknowledged changes" seeded from the persisted read state at scan, surviving reload. `freshDiffs` (the Diff-toggle "NEW" badge) is redundant with `recentRels` combined with `diffInfo`, and is removed; the toggle badge shows unread iff `recentRels.has(rel) && diffInfo.has(rel)`.

*Why keep `recentRels` reactive rather than deriving:* unread-for-new-files depends on snapshot absence, which is known only in `store.js` scan-time state, not derivable from the in-memory signal graph. A reactive `Set` rebuilt at scan and decremented at acknowledgment is the simplest correct representation.

### D6: Persistence is fire-and-forget, matching existing IDB style

`markRead(rel, hash)` is an idempotent `put` into the snapshot row (preserving `text`/`mtime`, setting `readHash`) on a readwrite transaction, awaited-but-non-fatal like `saveHandle`. On IDB failure the marker may re-surface next scan — an acceptable degradation consistent with the app's existing non-fatal persistence.

### D7: Copy changes from "new" to "unread"

The marker semantics change from "changed this session" to "has unacknowledged changes", so the group counter (`+N new` → `+N unread`) and the dot tooltip are updated to stay honest. Cosmetic, folded into the same MINOR bump.

## Risks / Trade-offs

- [Read state preserved via snapshot overwrite could be silently dropped] → The scan already holds the old snapshot when it writes the new one; carry `snap.readHash` through, and never have the scan set `readHash` (only acknowledgment writes it) with a fallback to preserve it.
- [Object store / snapshot write races with the 10s poll] → `scan()` is guarded by `isScanning`; acknowledgment writes only flip `readHash` and never current `text`, so a concurrent scan cannot clobber a new file's text.
- [Upgrade re-flags files changed just before the release] → Acceptable and intended: any file whose content differs from its snapshot and has no `readHash` is genuinely unseen; it clears on acknowledgment and never re-flags unless it changes again.
- [Relying on `lastModified` granularity for modification detection is unchanged] → This feature does not change how modifications are detected; it only changes how acknowledgment is tracked, so no new exposure.

## Migration Plan

No database schema change (IDB stays version `2`; existing snapshot rows simply lack `readHash`). No serving or service-worker change beyond the routine version-marker bump (`2.0.1 → 2.1.0` across index.html comment + header badge and sw.js `CACHE_VERSION`) so the refreshed cache ships the new behavior. Rollback is a normal revert: old builds ignore the extra `readHash` field.

## Open Questions

- Whether a "mark all as read" control is wanted later. Deferred: with per-file read state, a stale pile of unread diffs is a plausible future want, but it is not part of this change's acceptance criteria.
