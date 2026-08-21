## Context

Read state is per-artifact: each file's snapshot row in IndexedDB holds `readHash` + `unread`, and the reactive `recentRels` set drives unread markers and group counters. `components/osv-pane/osv-pane.js`'s `openChange(key)` renders the change's tabs but acknowledges only the active tab via `acknowledgeShown(t.rel)`, so siblings stay unread until individually activated. Archived change keys are `changes/archive/<name>` (3 segments from `changeOf`), so they're trivial to detect. See proposal.md - Why for motivation.

## Goals / Non-Goals

**Goals:**
- Open an archived change → all its artifacts become read in one step (markers, diff counts, Archive group counter all clear).
- Persist the bulk acknowledge through the existing `markRead` → IndexedDB snapshot path.
- Leave active-change per-artifact acknowledgment untouched.

**Non-Goals:**
- Not bulk-acknowledging active changes (review integrity).
- Not changing diff detection/snapshots, metadata handling, or the content-diff read model.

## Decisions

**D1 — Detect archived change by key prefix in `openChange`.** In `openChange(key, initialRel)`, when `key.startsWith('changes/archive/')`, run a bulk acknowledge over `meta.files` before/around rendering. This fires whether the user opened the change row directly or an individual archived file (both route through `openChange`), matching "open the archived spec → whole change read".

**D2 — Acknowledge against each artifact's current content hash.** For every file in the change, read its live text, compute `hashText(text)` (from app/diff.js), and call the existing per-rel markRead path (store `markRead` + removing from `recentRels`). Using the current hash, not each file's pending diff hash, means: (a) the whole change is acknowledged as "seen at this version", and (b) any file that changes again after opening re-flags unread on the next scan (its new hash ≠ the stored readHash).

- *Alternatives considered:* marking each file with its existing `diffInfo` hash. Rejected — that acknowledges an older version and can leave a file oddly flagged if a scan lands between open and acknowledge. Current-hash is simpler and consistent with `acknowledgeShown`'s no-pending-diff branch.

**D3 — Reuse the existing `markRead` + `recentRels` mechanism; no new persistence path.** `markRead(rel, hash)` already updates `readHash`+`unread:false` on the snapshot (preserving text/mtime), and the pane's `markRead` wrapper removes the rel from `recentRels`, which reactively clears the Archive counter and markers. Metadata files are included harmlessly (they are already never unread).

**D4 — Scope strictly to archived changes.** The bulk branch is gated on the archive key prefix only; active changes continue through the normal per-tab `acknowledgeShown` flow.

**D5 — Version is MINOR.** A visible behavior change → `2.17.0`. Three markers bumped together in the same commit: the `index.html` first-line comment, `VERSION` in `components/osv-header/osv-header.js`, and `CACHE_VERSION` in `sw.js`.

## Risks / Trade-offs

- **Reading every file's text on archive open is async work** → Archived changes are small and `markRead` is fire-and-forget/non-fatal; a single awaited loop keeps it simple and the file list updates via reactivity.
- **Bulk-acknowledge hides an unseen archived diff** → Accepted: archived changes are history, not review targets (this is the whole point of the change). The diff content is still viewable on the tab; only the unread *indication* clears.
- **Concurrent scan during acknowledge** → Low risk: `markRead` spreads the existing snapshot (preserving text/mtime) and only overwrites `readHash`/`unread`; any newer change re-flags on the next scan (D2).

## Migration Plan

No data migration. Existing read state is compatible; the new behavior only acknowledges more rels than before when an archived change is opened.

## Open Questions

None.
