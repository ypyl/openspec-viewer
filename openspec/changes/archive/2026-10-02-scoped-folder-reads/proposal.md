# Proposal

## Why

The reload control walks the entire `openspec/` tree and calls `getFile()` on every artifact to read its modification time. On a local disk that is milliseconds, but the app is often run from Windows against a folder mounted over the WSL/9p share (`\\wsl.localhost\...`), where every call is a network round trip. A reload over a large tree (most of it `archive/`) takes seconds, which makes the control the slowest thing in the app.

## What Changes

- Scope a reload to what the user is looking at: when a folder has been read before, a reload walks only the **expanded** groups in the sidebar, plus the group of the artifact currently open. Collapsed groups are not walked or re-read.
- Keep collapsed groups intact between reads: their file list entries, unread state, diffs, and group counter stay as of the last time that group was read.
- Read a collapsed group when the user **expands** it, so what is shown is current. This is where a change to an archived artifact surfaces.
- A folder's **first** read (add, or first open in a session) still reads every group, so the file list, counters, and search cover the whole folder from the start.
- Cut the round trips a read does make: stat a directory's files concurrently instead of one at a time.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `change-monitoring`: a read is scoped to the viewed groups; the reload requirement is narrowed to match, and group counters for collapsed groups are defined as retained-until-read.

## Impact

- `app/store.js`: `walkDir`/`scan` take a read scope (which group roots to walk); `startMonitoring`/`reloadActiveFolder` pass it; add a per-group read used when a group is expanded.
- `components/osv-file-list/`: expanding a collapsed group triggers a read of that group.
- `app/state.js`: the read scope needs the active folder's collapsed set (already available as `collapsed`).
- Behavior trade-off: an artifact that changes inside a collapsed group is not detected by a reload until that group is expanded (or the folder is added/opened fresh). This is deliberate and is the whole point of the change.
- Version bump: MINOR (visible behavior change, no data migration).
- Future option (out of scope): a `FileSystemObserver`-tracked dirty set would remove the walk entirely, but the API is experimental and its behavior over a UNC/9p mount is unverified.
