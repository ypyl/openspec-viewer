## Why

A change's metadata file (`.openspec.yaml`) is tracked for unread/new changes like any other artifact, so creating or editing it forces the whole change to show as unread. Metadata is incidental bookkeeping the user rarely needs to open, so it should not gate the change's read state.

## What Changes

- The system no longer treats a change's metadata file (`.openspec.yaml`) as an artifact with unread changes.
- Creating or modifying a change's metadata file does **not** mark the containing change as unread, does not add a "new" marker or count it in the group counter, and does not need to be opened to acknowledge the change.
- The metadata file stays visible in the file list and remains readable (it still opens in the change's tabs, showing the metadata card / raw YAML as before). Only its influence on unread tracking is removed.
- Existing persisted unread state for metadata files is cleared, so a returning user with stale markers sees them disappear.
- Reasonable assumption: the change's metadata file is the one OpenSpec writes at `<change>/.openspec.yaml` (this repo's change metadata file). It applies to both active changes and archived changes.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `change-monitoring`: unread/new tracking must exclude a change's metadata file from marker, group-counter, and acknowledge-without-opening behavior, while the file remains visible and readable.

## Impact

- **Code**: `app/store.js` (unread seeding/carry-forward in the scan loop), `components/osv-file-list/osv-file-list.js` (group counters, change-row and item `new` markers/dots, diff hints), and the path model in `app/model.js` (a helper to identify the change's metadata file).
- **Persistence**: IndexedDB snapshots for metadata files keep an `unread` flag from earlier scans; these must no longer re-seed `recentRels` (clear or ignore on load).
- **Specs**: delta under `specs/change-monitoring/spec.md`.
- **Version**: MINOR bump (visible behavior change) across all three markers in the same commit.
- **No** new dependencies, no change to serving/offline/install behavior.
