# Proposal: Mark diff (changes) as read

## Why

The "new" markers (green dot, `+N new` group counters, NEW badge on the Diff
toggle) are session-scoped: they mean "changed this session, not opened this
session", are held only in memory, and reload resets them — the first scan then
re-flags everything that differs from a persisted snapshot, even files the user
already reviewed. There is also no per-file way to acknowledge changes: opening
a change blanket-clears every file in it without the user looking at any of
them. Users need an explicit, persistent "read" state so reviewed changes stay
reviewed across reloads and unread diffs surface until actually viewed.

## What Changes

- Persist a per-file read pointer (`readHash`, a fingerprint of the text
  version last acknowledged) inside the existing IndexedDB snapshot rows — no
  new store, no database version bump.
- Define read semantics: opening a file's artifact view marks it read **only
  when no diff exists** (a brand-new file has no baseline and no diff view, so
  its artifact *is* the change); opening the Diff view always marks it read.
  A file edited after being read becomes unread again (its text no longer
  matches its read pointer).
- Only the most recent change per artifact is ever surfaced; no change history
  is stored — two edits while unread show only the latest diff under a single
  unread flag.
- Replace session-scoped "new" markers with the persistent unread state:
  markers and group counters reflect genuinely unread changes and survive
  reloads; the reload "changed since your last visit" toast narrows to unread
  changes.
- Opening a change no longer acknowledges all of its files at once; each
  artifact is acknowledged only when its own view/diff is actually opened.
- Fold the in-memory `freshDiffs` "NEW" toggle badge into the persisted read
  state (a rel showing NEW iff it is unread and has a diff).
- Rename the visible copy from "new" to "unread" (group counter, dot tooltip).
- Version bump: MINOR (visible behavior change) `2.0.1 → 2.1.0` on all three
  markers (index.html comment + header badge, sw.js CACHE_VERSION).

No breaking changes; no change to serving, install, or dependencies.

## Capabilities

### New Capabilities

- `change-monitoring`: Change detection and visibility — how the app detects
  file changes (mtime + content diffs against IndexedDB snapshots), how it
  flags them as unread, and how read state is persisted and acknowledged. This
  behavior has been running unspecced until now; read-state is its first
  requirement, with the existing detection/diff behavior also captured.

### Modified Capabilities

- None. Serving, offline, and version-marker handling (`app-delivery`) are
  unchanged; the version bump is already a requirement there.

## Impact

- `app/state.js`: `recentRels` meaning changes to "rels with unacknowledged
  changes"; `freshDiffs` merged into it (or derived from it + `diffInfo`).
- `app/store.js`: snapshot rows gain `readHash`, preserved across snapshot
  overwrites during scans; new `markRead(rel, hash)` persistence, fire-and-
  forget like existing IDB writes; unread seeding derived from readHash vs
  current text at scan time.
- `app/diff.js`: `diffLines` results carry a hash of the new text so marking
  read is exact; NEW-badge derivation reads unread state; new tiny hash helper
  (no dependencies).
- `components/osv-pane/osv-pane.js`: toggle handler marks read on diff view;
  `openFile`/`activateTab` mark read in the no-diff branch; `clearRecentForMeta`
  removed.
- `components/osv-file-list/osv-file-list.js`: marker/counter wiring driven by
  the persisted unread set.
- Tests: new e2e scenarios in `diff-test.js` (unread → read flow, reload
  persistence, re-flag on re-edit); `migration-test.js` unchanged (no schema
  migration).
- Version markers in `index.html` and `sw.js`.
