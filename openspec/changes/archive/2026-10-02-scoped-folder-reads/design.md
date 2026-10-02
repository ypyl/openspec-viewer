# Design

## Context

See `proposal.md` for motivation.

`app/store.js` has one read path. `walkDir(rootHandle, '', signal)` recursively yields every file under the resolved `openspec/` root; `scan()` filters each entry through `isRelevant`/`groupOf`, calls `getFile()` for its `lastModified`, and reads content only when the mtime differs from `st.fileState`. The file list renders from `st.files` (rel + handle), diffs from `st.diffInfo`, unread from `st.recentRels`.

The sidebar groups are `Changes`, `Specs`, `Archive`, `Config` (`state.GROUPS`), derived from the rel by `model.groupOf`. The active folder's collapsed set is the `collapsed` signal, hydrated per folder on switch from `osviewer.collapsed.<id>`; Archive and Config default to collapsed.

On WSL/9p every `dir.values()` step and every `getFile()` is a round trip, so the O(files) walk dominates a reload.

## Goals / Non-Goals

**Goals:**
- A reload after the first read walks only the groups the user is looking at.
- Expanding a collapsed group reads just that group.
- A folder's first read still covers everything, so the list, counters, and search are complete from the start.
- Fewer round trips for the part of the tree a read does walk.

**Non-Goals:**
- No change to the snapshot/diff/unread data model.
- No `FileSystemObserver` and no external index; that is a separate, later option.
- Not addressing the page-load content read (a separate fix: seed `fileState` from stored snapshot mtimes).

## Decisions

**Scope reads by group, derived from the collapse state.** A read computes the set of group roots to walk: `Changes` → `changes/` excluding `changes/archive/`, `Archive` → `changes/archive/`, `Specs` → `specs/`, `Config` → `config.yaml` and `config/`. Collapsed groups are excluded after the first read. The group holding the currently open artifact (`currentRel`/`currentKey`) is always included, so an artifact that is open but whose group is collapsed still refreshes. `walkDir` gains a bounded form (walk these subdirectory handles) instead of always walking the root. Alternative considered: skip only `archive/` always — rejected as a special case that does not generalize to a collapsed `Specs`.

**First read reads every group; later reads are scoped.** This keeps the initial experience complete (list, counters, search, "changes since your last visit") and confines the scoping to reloads and re-reads, which is where the cost is. Alternative: scope from the first read too — rejected because the Archive group would open empty and the folder-level counters and search would be incomplete until the user happened to expand everything.

**Expanding a collapsed group reads that group, incrementally.** Because a reload skips collapsed groups, an open must refresh. The read is mtime-incremental (only changed files are read) and reuses the existing reading indicator. Alternative: mark a collapsed group "dirty" on reload and read on expand only if dirty — rejected, it cannot know a group is dirty without walking it, which is the cost being avoided.

**A scoped read only rebuilds the groups it walked.** Before adding a read group's entries, its existing entries are dropped from `st.files`/`fileState`/`recentRels`/`diffInfo`, then the walked group is merged in. Entries and unread/diff state for unwalked groups are left untouched. So removals and new files are detected only inside walked groups. This is the deliberate trade-off, expressed in the spec.

**Stat a directory's files concurrently.** After enumerating a directory, its `getFile()` calls run under a small concurrency cap (`Promise.all` in chunks) instead of a sequential `await`. This overlaps 9p latency. The cap keeps the share from being flooded and the result is collected into the same map, so ordering is unaffected. Alternative: keep it sequential — rejected for the exact case this change targets.

## Risks / Trade-offs

- **A change in a collapsed group is not seen by a reload** → intended; it surfaces when the group is expanded (or the folder is added/opened fresh). Documented in the spec.
- **A deletion in a collapsed group is not noticed** → same, and only for groups never expanded.
- **Reading on expand can feel like a pause over WSL** → the read is incremental and shows the reading indicator; expanding a small group (Config, a small Archive) is quick.
- **`st.files` merge can duplicate or orphan entries** → rebuild strictly per walked group: drop the group's entries, then add the walked ones.
- **Concurrent stats could stress the share** → bounded concurrency, tuned low.
- **The open artifact's group defeats the optimization while it is open** → acceptable; it keeps the on-screen artifact correct, and it is one group (usually `Changes`).

## Migration Plan

None; no data or schema change. Bump the version MINOR in the same commit across the three markers.
