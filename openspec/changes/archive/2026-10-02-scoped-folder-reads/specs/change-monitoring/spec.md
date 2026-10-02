# Spec Delta

## ADDED Requirements

### Requirement: Read only the groups being viewed

When a folder has already been read, the system SHALL limit any later read — the reload control, and any other re-read — to the artifact groups that are expanded in the sidebar, together with the group of the artifact currently open. It SHALL NOT walk or re-read artifacts in collapsed groups. Artifacts in a collapsed group SHALL keep the file list entries, unread state, diffs, and group counter from the last time that group was read. The system SHALL read a collapsed group when the user expands it, so the group reflects the folder's current contents when it is shown. A folder's first read (when it is added, or first opened in a session) SHALL read every group, so the file list, counters, and search cover the whole folder from the start.

#### Scenario: Reload skips collapsed groups
- **WHEN** a folder has been read, the Archive group is collapsed, and the user activates the reload control
- **THEN** only the expanded groups are walked and the Archive group keeps the contents and unread state from its last read

#### Scenario: Expanding a collapsed group reads it
- **WHEN** the user expands a group that is collapsed
- **THEN** the system reads that group's artifacts and shows their current contents and unread state

#### Scenario: A change in a collapsed group surfaces on expand
- **WHEN** an artifact in a collapsed group changes on disk and the user later expands that group
- **THEN** the artifact appears with its content diff and unread marker

#### Scenario: The open artifact's group is read
- **WHEN** the user reloads while an artifact from a collapsed group is open
- **THEN** that group is read so the open view reflects the current contents

#### Scenario: The first read covers every group
- **WHEN** a folder is added or first opened in a session
- **THEN** every group is read, including collapsed ones

## MODIFIED Requirements

### Requirement: Reload the active folder on demand

The system SHALL provide a reload control that rescans the active folder when activated. The reload SHALL scan only the active folder and SHALL NOT scan any other open folder. The scan SHALL refresh the folder's exposed artifact list, its content diffs, its unread markers, and its searchable contents in place, without a page reload, and SHALL surface detected changes with the same notice behavior as any scan. Which parts of the folder the scan walks SHALL follow the read-scope rules (see "Read only the groups being viewed"): after the folder's first read, a reload reads only the expanded groups and the open artifact's group. While the reload is running the system SHALL show the reading progress indicator, and the reload SHALL be cancelable the same way an initial read is. The reload control SHALL be unavailable when no folder is active and for session-only (uploaded) folders, which have no folder to rescan.

#### Scenario: Reload picks up an external change
- **WHEN** an artifact in an expanded group of the active folder changes on disk while the app is open and the user activates the reload control
- **THEN** the artifact appears with its content diff, its unread marker, and its updated change-count labels, without a page reload

#### Scenario: A newly added artifact appears after reload
- **WHEN** an artifact is added to an expanded group and the user activates the reload control
- **THEN** the artifact appears in the list, marked unread unless it has no content baseline

#### Scenario: A removed artifact disappears after reload
- **WHEN** an artifact is removed from a group that the reload reads and the user activates the reload control
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

### Requirement: Group counters reflect unread changes

Group counters SHALL count artifacts (or changes) with unacknowledged changes, and SHALL be cleared once those changes are acknowledged. They SHALL reflect read state across reloads rather than changes made in a single session. A counter for a collapsed group SHALL reflect that group's last read and SHALL update when the group is next read.

#### Scenario: Counter clears when changes are acknowledged
- **WHEN** the user acknowledges every changed artifact counted in a group
- **THEN** the group's counter is no longer shown

#### Scenario: Counter persists across reload until acknowledged
- **WHEN** a group contains unacknowledged changes and the user reloads the page
- **THEN** the group counter still reflects those unacknowledged changes after the reload

#### Scenario: Collapsed group counter updates on expand
- **WHEN** an artifact in a collapsed group changes on disk and the user expands that group
- **THEN** the group's counter reflects the artifacts found by that read
