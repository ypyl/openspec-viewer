## Why

The app monitors exactly one openspec folder per session. Anyone working across
several repos (or a monorepo's nested openspec roots) must re-pick the folder
every time they switch projects, and only one project can be watched at once.
Opening multiple projects side by side is a daily workflow; today the app
cannot represent it.

## What Changes

- **New narrow folder rail** (left of the existing file list): a fixed-width
  icon column with the add-folder action (`+`) at the top and one avatar button
  per opened folder — first letter of the project name inside, full name on
  hover tooltip, active folder highlighted, and a green unread dot when that
  folder has unacknowledged changes. Clicking an avatar switches the active
  folder.
- **Name + close row replaces "Select Folder to Monitor"**: the file-list
  header shows the active folder's project name (ellipsized with tooltip) plus
  a small square close button. Closing always closes the active folder (close =
  forget: the persisted handle and its IndexedDB snapshots are removed); the
  next folder down the rail becomes active.
- **Multi-folder monitoring**: every opened folder keeps its own file
  snapshots, unread/read state, diffs, selection, and open-change tabs, all
  keyed by folder id. Each folder is live-monitored independently; background
  change notices are prefixed with the folder name.
- **Session restore**: on reload, all folders with granted permission re-open
  and resume monitoring, with one aggregated notice (folders whose permission
  was revoked are listed as skipped).
- **Uploads as session-only entries**: folders added via the webkitdirectory
  fallback join the rail with a hollow-ring avatar, no unread dot, and no
  persistence — gone on reload.
- **Per-folder view state**: collapsed group headers are remembered per folder;
  the sidebar filter and content search are reset when switching folders.
- **Per-folder review data**: highlights/comments and prompt paths are scoped
  per folder (two folders may contain the same rel path).
- **Search is scoped to the active folder.**
- **BREAKING**: new primary navigation column, IndexedDB schema v2→v3
  migration (folder registry + snapshots re-keyed by folder id), removed
  "Select Folder to Monitor" control, and headers/tooltips replace the old
  single-folder model. Version bump: **3.0.0** (MAJOR).

## Capabilities

### New Capabilities
- `project-switcher`: the folder rail (add/switch/close folders, avatars,
  unread dots, tooltips, upload entries, dedup, session restore) and the
  per-folder scoping of the sidebar's group collapse state.

### Modified Capabilities
- `change-monitoring`: monitoring, snapshots, diffs, and unread/read tracking
  become per-folder; background folders keep polling and prefix their notices;
  closing a folder deletes its snapshots; reload re-opens all granted folders.
- `file-list`: the sidebar renders the active folder's artifacts only, with a
  no-folder empty state; group collapse state is per folder.
- `content-search`: search indexes and results are scoped to the active folder;
  the query resets when switching folders.
- `review`: highlights/comments are keyed per folder (existing data re-homed to
  the migrated legacy folder); prompt paths are folder-qualified.

## Impact

- `app/store.js` (state model, IDB v2→v3, per-folder poll loops, migration),
  `app/state.js` (folder registry + projected view signals), new
  `components/osv-folder-rail/` component, `components/osv-file-list/*`
  (name/close row, per-folder render), `app/annotations.js`,
  `app/search.js`, `app/prompt.js`, `app/diff.js`, `index.html` layout,
  `styles/`, `sw.js` + header badge + first-line comment (version markers).
- No new runtime dependencies; no build step; serving/offline story
  (app-delivery) unchanged — the service worker and GitHub Pages deployment
  stay as-is.