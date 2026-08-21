## ADDED Requirements

### Requirement: Opening an archived change acknowledges all its artifacts
The system SHALL acknowledge every artifact of an archived change when the user opens that archived change or any artifact within it, marking each artifact as read against its current content in one step. Opening an archived change SHALL clear the unread indication and diff counts for all of its artifacts at once, and SHALL remove them from the Archive group counter. Active (non-archived) changes SHALL NOT be bulk-acknowledged: opening an active change SHALL acknowledge only the artifact the user is viewing, leaving its siblings unread until each is opened individually. The acknowledge SHALL be persisted so the archived change stays read across reloads.

#### Scenario: Opening an archived change clears all unread markers at once
- **WHEN** the user opens an archived change whose artifacts carry individual unread markers
- **THEN** every artifact of that change is marked read and its unread marker and diff counts are cleared without needing to open each one

#### Scenario: Opening an archived spec clears the whole change
- **WHEN** the user opens a single artifact inside an archived change, such as one of its spec files
- **THEN** all artifacts of that archived change are marked read, not just the one opened

#### Scenario: Archive group counter clears
- **WHEN** the user opens an archived change whose artifacts were counting toward the Archive group counter
- **THEN** the Archive group counter no longer includes that change's artifacts

#### Scenario: Persistent across reloads
- **WHEN** the user opens an archived change and then reloads the app
- **THEN** the archived change's artifacts remain read

#### Scenario: Active changes still acknowledge per artifact
- **WHEN** the user opens an active change that has unread sibling artifacts
- **THEN** the sibling artifacts remain unread until each is opened individually

#### Scenario: A newer change after opening stays unread
- **WHEN** an artifact of an archived change changes again after the change was opened and acknowledged
- **THEN** that artifact is flagged unread again
