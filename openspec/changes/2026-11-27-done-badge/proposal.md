## Why

The Changes group tells you what is new and what is unread, but nothing tells you which changes are finished. A change stays in `changes/` until it is archived by the CLI, and reading a row's Proposal, Tasks, or Specs does not say whether the work is done: you open the change and scroll to `tasks.md` to count checkboxes. Applied-but-unarchived changes are exactly the ones a reviewer wants to find and archive, and today they look identical to work in progress.

## What Changes

- A change row in the **Changes** group carries a small **done** badge next to its name when its `tasks.md` exists and every task in it is checked. That is the app's only available signal that the change was applied and is waiting to be archived — the CLI marks completion by moving the directory into `changes/archive/`.
- The badge's tooltip carries the task count (`3/3 tasks done — applied, waiting to be archived`), so it also says how much work the change carried.
- No badge for a change with an open task, for a change without `tasks.md`, or for any Archive row (archived changes are done by definition).
- The state is derived from file content, so it appears on the first read of a folder, updates on a reload or when the open `tasks.md` is edited, is restored from the persisted snapshot on a reload that re-reads nothing, and works in a session-only upload folder.
- Non-breaking: no storage schema, serving, or dependency change. Shipped in **v4.4.0** (MINOR: new visible indicator, all three version markers).

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `file-list`: adds the "done" badge on a Changes row — when it appears, what it says, and the rows that must never carry it.

## Impact

- `app/model.js` — `isTasksRel()` and `taskProgress()`, the pure checkbox counter shared by the badge and the tasks progress bar.
- `app/store.js` — records each change's task progress from the `tasks.md` text a folder read or the open-file watch already reads, from the persisted snapshot when the file did not change, and once for an upload folder; `app/state.js` mirrors it per folder.
- `components/osv-file-list/osv-file-list.js` + `.css` — the badge and its styling.
- `app/render.js` — the tasks progress bar now uses the same counter.
- `index.html`, `components/osv-header/osv-header.js`, `sw.js` — version markers.
- Tests: new `done-badge-test.js`; `tools/test-model.mjs` covers the two helpers.
