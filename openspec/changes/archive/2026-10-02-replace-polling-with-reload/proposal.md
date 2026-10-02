# Proposal

## Why

Every open folder is rescanned every 10 seconds whether or not anything changed, which keeps the disk busy, burns battery, and produces wake-ups for little benefit in the common case where the user is reading one folder at a time. A manual **Reload** button gives the user the same freshness on demand, with no background loop.

## What Changes

- Remove the per-folder 10-second polling loop. A folder is scanned when it is added or re-opened, and when the user explicitly reloads it.
- Add a **Reload** control for the active folder. Activating it rescans that folder and refreshes the file list, diffs, unread markers, group counters, and content-search index in place, showing the existing reading-progress indicator (with cancel) while it runs.
- Remove the header "● live" indicator, since files are no longer monitored live.
- **BREAKING**: opening a folder no longer live-monitors it. Changes made while the app is open are only detected when the user reloads the folder that contains them. A background folder's rail unread dot therefore updates when the user switches to it and reloads, not on its own.
- Keep everything else about change detection: the initial read on add/re-open, content diffs rebuilt from snapshots, per-folder unread tracking, "changes since your last visit" notices, and "Mark all as read".

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `change-monitoring`: the "Folders are monitored independently" polling requirement is replaced by an on-demand active-folder reload requirement; the initial read on add/re-open is unchanged.
- `project-switcher`: the rail unread indicator no longer reflects background monitoring (it reflects the last scan of each folder); restoring folders on reload performs the initial read but does not resume live monitoring.
- `content-search`: search results track the active folder's contents as of its last scan (open/re-open/reload) instead of a live scan.

## Impact

- `app/store.js`: remove `pollTimers`/`stopTimer`/the `setInterval` in `startMonitoring`; add a `reloadActiveFolder()` entry point that runs `scan()` for the active folder.
- `components/osv-header/`: replace the "● live" badge with the Reload control; `osv-header.css` styling.
- `README.md`: the live-monitoring / 10s-poll description.
- `content-search`: no code change beyond the scan no longer running on a timer; `searchVersion` still bumps on each scan.
- Version bump: **MAJOR** (automatic monitoring is removed). With no build step, MAJOR (e.g. 3.21.0 → 4.0.0) costs nothing but signals the dropped behavior clearly.
- E2E tests that relied on a background poll to surface changes must trigger a reload instead.
