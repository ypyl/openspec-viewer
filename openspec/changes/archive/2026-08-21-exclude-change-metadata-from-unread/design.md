## Context

See proposal.md — Why for motivation.

Unread/new state is a single signal, `recentRels` (`app/state.js`), a `Set` of relative paths with unacknowledged changes. It is rebuilt inside the scan loop in `app/store.js`: unread is computed per file (brand-new file, or content changed away from the persisted read hash) and accumulated into `nextUnread`, seeded from the previous scan's set (the "carry forward" that persists unread across reloads). Everything that displays unread reads only `recentRels`:

- `components/osv-file-list/osv-file-list.js` — group counters (`newCount`), change-row `new` dots, per-item `new` dots, and the change rows where a file is unread.
- `diffToggleHtml` / `diffTabBadgeHtml` (`+a −r` badges) in `app/diff.js` / `osv-pane` — driven by `diffInfo` combined with `recentRels`.

A change's metadata file, `changes/<name>/.openspec.yaml` (and its archived copy), is a normal relevant artifact today: `isRelevant` returns true and `groupOf` places it in Changes/Archive, so it flows into `recentRels` exactly like proposal/spec/design/tasks. It is shown as the "Metadata" tab (osv-pane already finds `*.openspec.yaml`).

## Goals / Non-Goals

**Goals:**
- Keep a change's metadata file out of `recentRels` so it never drives a `new` marker, group counter, or `+a −r` badge.
- Keep the metadata file visible in the file list and readable in the change's tabs (unchanged).
- Clear any previously persisted unread flag for metadata files so stale markers disappear without a manual migration.

**Non-Goals:**
- Not changing which file counts as "metadata" (scoped to `.openspec.yaml`, this repo's change metadata file) or renaming it.
- Not removing the metadata file from the file list / pane — it stays shown and readable.
- Not changing content-diff computation: if a metadata file's content changed and a snapshot exists, a diff remains available to view; it just no longer implies unread.

## Decisions

**D1 — Identify metadata at the model layer.** Add a pure helper in `app/model.js`, e.g. `isChangeMetadata(rel)` = `rel.endsWith('.openspec.yaml')`, re-exported via `render.js` like the other path helpers. This is one source of truth, unit-testable in the existing node `--test` suite, and reusable by store and any future consumer. Alternative considered: checking `artifactOf(rel) === 'Metadata'`; rejected because that couples unread logic to a display label and is less explicit.

**D2 — Exclude at the source (store.js), not at each consumer.** Because every counter/marker/badge reads `recentRels`, keeping metadata out of that one set makes all consumers correct automatically, with no per-section guards. Two changes in the scan loop:
- When processing a metadata rel, force `isUnread = false` and persist `unread: false` in its snapshot, so a previously-unread metadata snapshot stops reseeding on later scans.
- When seeding `nextUnread` from the carried-forward `prevUnread`, filter out metadata rels: `new Set([...prevUnread].filter(rel => !isChangeMetadata(rel)))`. This drops stale persisted metadata unread in the current session (and, combined with the forced `unread:false`, permanently).
Alternative considered: filtering in `osv-file-list.js` per section/row; rejected — more code paths to keep in sync and easy to miss one (tab badges, toggle, search results).

**D3 — No IndexedDB schema/migration.** Existing snapshots for metadata may hold `unread:true` from before; the scan overwrites them with `unread:false`, so stale flags self-heal. `recentRels` itself is regenerated each scan, so an in-memory filter handles the current session until then.

**D4 — Consumers unchanged.** `osv-file-list` needs no logic change once `recentRels` excludes metadata. Its counters iterate `recentRels`, so a metadata-only unread never contributes. A brief comment at the carry-forward site documents why metadata is filtered.

## Risks / Trade-offs

- [Metadata content diff still viewable (`+a −r` from `diffInfo`) even though unread is cleared] → Accepted: unread/read state is the contract this change alters; a read-only diff for an auxiliary file is harmless and consistent with every other changed file. Not suppressing it keeps the change minimal.
- [Stale metadata unread persists until the next scan] → The forced `unread:false` write plus the carry-forward filter clear it on the next 10s poll; effectively immediate.
- [OpenSpec renames the metadata file away from `.openspec.yaml`] → The predicate misses it and it behaves like any other artifact again (graceful degradation). Scope is documented as `.openspec.yaml`; extend the predicate if the format changes.

## Migration Plan

No data migration: stale IndexedDB `unread` flags on metadata files are overwritten on the next scan. Rollback: revert the store.js predicate + carry-forward filter and the model helper; the `unread:false` writes simply re-enable tracking, and the next scan re-seeds flags from content hashes.

## Open Questions

None that change the approach. (Whether to suppress metadata diffs entirely is deferred — treated as out of scope; see Risks.)
