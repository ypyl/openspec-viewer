# Spec Delta

## REMOVED Requirements

### Requirement: Folders are monitored independently
**Reason**: Automatic polling is removed. The app no longer scans folders on a timer, so a background folder no longer detects changes on its own.
**Migration**: Use the active folder's Reload control to pick up changes on demand. Background folders are not scanned automatically; switch to a folder and reload it to detect its changes. A restored folder's changes since the last visit are still reported by the initial read on re-open.

## ADDED Requirements

### Requirement: Reload the active folder on demand

The system SHALL provide a reload control that rescans the active folder when activated. The reload SHALL scan only the active folder and SHALL NOT scan any other open folder. The scan SHALL refresh the folder's artifact list, its content diffs, its unread markers, its group counters, and its searchable contents in place, without a page reload, and SHALL surface detected changes with the same notice behavior as any scan. While the reload is running the system SHALL show the reading progress indicator, and the reload SHALL be cancelable the same way an initial read is. The reload control SHALL be unavailable when no folder is active and for session-only (uploaded) folders, which have no folder to rescan.

#### Scenario: Reload picks up an external change
- **WHEN** an artifact in the active folder changes on disk while the app is open and the user activates the reload control
- **THEN** the artifact appears with its content diff, its unread marker, and its updated change-count labels, without a page reload

#### Scenario: A newly added artifact appears after reload
- **WHEN** an artifact is added to the active folder and the user activates the reload control
- **THEN** the artifact appears in the list, marked unread unless it has no content baseline

#### Scenario: A removed artifact disappears after reload
- **WHEN** an artifact is removed from the active folder and the user activates the reload control
- **THEN** the artifact no longer appears in the list or in search results

#### Scenario: Reload scans only the active folder
- **WHEN** more than one folder is open and the user activates the reload control
- **THEN** only the active folder is scanned, and every other open folder keeps the state from its own last scan

#### Scenario: Reload is cancelable
- **WHEN** a reload is in progress and the user cancels it
- **THEN** the scan stops and the folder keeps the state it had before the reload

#### Scenario: Uploaded folder cannot be reloaded
- **WHEN** the active folder is a session-only upload, or no folder is active
- **THEN** the reload control is unavailable
