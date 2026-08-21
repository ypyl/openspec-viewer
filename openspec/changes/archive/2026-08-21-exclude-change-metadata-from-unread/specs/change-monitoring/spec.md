## ADDED Requirements

### Requirement: Exclude a change's metadata file from unread tracking

The system SHALL NOT treat a change's metadata file as unread. Creating or modifying the metadata file SHALL NOT mark the containing change as unread, SHALL NOT add a "new" marker to the change or to its row in the file list, and SHALL NOT increment a group counter. The user SHALL NOT be required to open the metadata file to acknowledge the change. The metadata file SHALL remain visible in the file list and readable in the change's content view; only its influence on unread/read tracking is removed.

#### Scenario: Modifying metadata does not flag the change
- **WHEN** a change's metadata file is created or modified while the change otherwise has no unread changes
- **THEN** the change is not marked unread and no "new" marker or group counter appears for it

#### Scenario: A brand-new metadata file does not flag the change
- **WHEN** a new change has only its metadata file as content and has not been acknowledged
- **THEN** the change is not marked unread and does not count toward the group counter

#### Scenario: Metadata file stays visible and readable
- **WHEN** the user opens a change
- **THEN** the change's metadata file still appears in the file list and is still readable in the change's content view

#### Scenario: Opening metadata is not required to acknowledge a change
- **WHEN** the user acknowledges every other artifact of a change but never opens its metadata file
- **THEN** the change's read state reflects only the other artifacts and the unopened metadata file does not keep it unread

#### Scenario: Stale persisted metadata unread state is cleared
- **WHEN** a metadata file was previously tracked as unread and is re-scanned after this exclusion takes effect
- **THEN** it is no longer considered unread, and any previously persisted unread flag for it does not re-flag the change across reloads
