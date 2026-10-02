# Spec Delta

## MODIFIED Requirements

### Requirement: Add a folder from the rail

The rail SHALL provide an add action (a `+` icon at its top) that opens a folder picker and opens the selected openspec root, performing its initial read. When the File System Access API is unavailable, the same action SHALL fall back to a folder-upload control. Adding a folder SHALL NOT reset or disturb any already-open folder. Picking a folder that is already open SHALL NOT add a duplicate; it SHALL switch to the existing entry instead. Two different folders whose project names collide SHALL be shown with a distinguishing suffix (e.g. a `#2`) in addition to their distinct avatar colors.

#### Scenario: Plus action opens the folder picker
- **WHEN** the user activates the `+` icon
- **THEN** a folder picker opens and the picked openspec root is added to the rail and read

#### Scenario: Same folder picked twice switches instead of duplicating
- **WHEN** the user picks a folder that is already open
- **THEN** no duplicate entry appears and that folder becomes active

#### Scenario: Name collision is disambiguated
- **WHEN** two different open folders have the same project name
- **THEN** the second one is shown with a distinguishing suffix wherever the name is displayed

#### Scenario: Existing folders are unaffected by an add
- **WHEN** the user adds a new folder while others are open
- **THEN** the previously open folders keep their state and are not rescanned

### Requirement: Folder avatars indicate unread changes

The system SHALL mark a folder avatar with a small indicator when that folder's artifacts have unacknowledged changes. The indicator SHALL disappear once all of that folder's changes are acknowledged, and SHALL NOT appear for session-only (uploaded) folders. The indicator SHALL reflect the folder's unacknowledged changes as of its most recent scan, so it updates when the folder is opened, re-opened, or reloaded, and does not change while the folder sits unscanned.

#### Scenario: Dot appears for a folder with unread changes
- **WHEN** a folder's scan, on open, re-open, or reload, finds unacknowledged changes
- **THEN** its avatar shows the unread indicator

#### Scenario: Dot clears when changes are acknowledged
- **WHEN** the user acknowledges all of a folder's unread changes
- **THEN** the folder's avatar no longer shows the unread indicator

#### Scenario: Uploaded folders never show the indicator
- **WHEN** a session-only (uploaded) folder has content the user has not opened
- **THEN** its avatar shows no unread indicator

### Requirement: Reload restores all granted folders

On reload, the system SHALL re-open every folder that was open before and whose permission is still granted, performing each folder's initial read. If multiple restored folders have changes since the last visit, the system SHALL show ONE aggregated notice naming those folders rather than a separate notice per folder. Folders whose permission is no longer granted SHALL be listed in the notice as skipped and SHALL NOT be re-opened.

#### Scenario: All granted folders re-open on reload
- **WHEN** the user reloads with three granted folders open
- **THEN** all three re-open, are read, and appear in the rail

#### Scenario: Changes since last visit are reported once
- **WHEN** two restored folders each changed since the last visit
- **THEN** a single notice names both folders instead of showing two notices

#### Scenario: Revoked-permission folders are skipped and reported
- **WHEN** a previously open folder's permission is no longer granted on reload
- **THEN** the folder is not re-opened and is mentioned as skipped in the aggregated notice

### Requirement: Uploaded folders are session-only rail entries

A folder added through the file-upload fallback SHALL appear in the rail with a visually distinct avatar (e.g. a hollow ring), SHALL NOT be rescanned after its initial read, SHALL NOT show an unread indicator, and SHALL NOT be restored on reload. Closing it SHALL behave like closing any other folder.

#### Scenario: Uploaded folder is marked session-only
- **WHEN** a folder is added via upload
- **THEN** it appears in the rail with a session-only marker, no unread indicator, and is not restored on reload

#### Scenario: Uploaded folder closes normally
- **WHEN** the user closes a session-only folder
- **THEN** it is removed from the rail and the next folder becomes active, as with any other folder
