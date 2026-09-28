## Why

When several folders are open, same-named projects (two checkouts of the same repo, forked copies, or a repo vs. its `openspec/` subfolder) are indistinguishable: the rail avatar and the sidebar name row show only the project name, so the user cannot tell which folder is actually active. The browser deliberately hides absolute filesystem paths, so the app must surface the identity it *can* see (how the folder relates to the openspec root, and its git origin) instead.

## What Changes

- Capture a folder's **pick relation** at open time: whether the picked folder was a repo root (root resolves to its `openspec/` subfolder) or an openspec root itself. Persist it with the folder entry so it survives reloads.
- Capture the folder's **git identity** at open time when the pick was the repo root and a `.git` exists: the origin remote URL and the current branch (from `.git/config` and `.git/HEAD`). Persist it with the folder entry.
- Show the relation and git identity in the **sidebar name row** as a small sub-line under the project name, and in the **rail avatar tooltip** so switched-away folders stay identifiable on hover.
- Upload-mode (session-only) folders get the same relation sub-line derived from their relative paths; they have no git identity.
- No new dependencies, no build changes. User-visible feature → MINOR version bump (all three markers, same commit).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-switcher`: The folder rail / name row gain identity information (pick relation, git origin + branch) alongside the existing name, name-row, and tooltip behavior.

## Impact

- `app/store.js` — capture relation + git identity at register time; persist in the IDB folder row; rehydrate on reload.
- `components/osv-file-list/osv-file-list.js` + `.css` — identity sub-line under the folder name row.
- `components/osv-folder-rail/osv-folder-rail.js` — extended avatar tooltip.
- `app/state.js` — folder entries gain the new identity fields.
- Version markers: `index.html` comment, `osv-header.js` VERSION, `sw.js` CACHE_VERSION (PATCH/MINOR policy → MINOR).
- No serving/installation changes; `app-delivery` untouched.