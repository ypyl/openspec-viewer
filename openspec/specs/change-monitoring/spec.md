# Capability: Change Monitoring

## Purpose

Defines how the OpenSpec Local Viewer detects and surfaces changes to OpenSpec artifacts: content-level diffs rebuilt from persisted snapshots, per-file unread/read tracking, and how that read state is acknowledged and persists across reloads.

## Requirements

### Requirement: Detect content changes

The system SHALL detect when an artifact's content changed since the last scan and surface a content-level diff showing the added and removed lines relative to the previously observed content. Artifacts whose content is unchanged SHALL show no diff.

#### Scenario: Unchanged artifact shows no diff
- **WHEN** an artifact's content is identical to the previously observed content
- **THEN** the artifact is not treated as changed and no diff is available for it

#### Scenario: Changed artifact shows a diff
- **WHEN** an artifact's content differs from the previously observed content
- **THEN** the system surfaces a unified diff of the change, and the diff persists across the page being reloaded

### Requirement: Track unread state per artifact

The system SHALL track, per artifact, whether the artifact has changes the user has not yet acknowledged ("unread"). An artifact SHALL be unread when it has changed since it was last acknowledged, and SHALL be unread when it has never been acknowledged. An unread artifact SHALL be visually indicated in the file/change list so the user can find it.

#### Scenario: Artifact with pending changes is unread
- **WHEN** an artifact has changed and the user has not acknowledged that change
- **THEN** the artifact is marked unread in the list

#### Scenario: Never-acknowledged new artifact is unread
- **WHEN** a new artifact appears that has no previous content baseline and has not been acknowledged
- **THEN** the artifact is marked unread in the list

#### Scenario: Read artifact is not marked unread
- **WHEN** an artifact has no unacknowledged changes
- **THEN** the artifact is not marked unread in the list

### Requirement: Acknowledge changes as read

The system SHALL mark an artifact as read only when the user has seen everything there is to see about it. Opening the diff view SHALL acknowledge the artifact. Opening the artifact's content view SHALL acknowledge it only when no diff exists for it (its content view is then the only thing to see).

#### Scenario: Opening the diff view acknowledges the artifact
- **WHEN** the user opens the diff view of an artifact that has a diff
- **THEN** the artifact is marked read and its unread indication is cleared

#### Scenario: Opening a changed artifact's content does not acknowledge it
- **WHEN** the user opens the content view of an artifact that has a pending diff
- **THEN** the artifact remains unread until the diff view is opened

#### Scenario: Opening a new artifact's content acknowledges it
- **WHEN** the user opens the content view of a brand-new artifact for which no diff exists
- **THEN** the artifact is marked read and its unread indication is cleared

### Requirement: Persist read state across reloads

The system SHALL persist each artifact's read state so it survives page reloads. A reload SHALL NOT re-mark artifacts that were already acknowledged as unread, and SHALL keep genuinely unacknowledged artifacts unread.

#### Scenario: Read state survives reload
- **WHEN** the user acknowledges an artifact and then reloads the page
- **THEN** the artifact remains read and is not re-flagged as unread

#### Scenario: Unread state survives reload
- **WHEN** an artifact has unacknowledged changes and the user reloads the page
- **THEN** the artifact is still marked unread after the reload

### Requirement: Re-flag an artifact when it changes again

The system SHALL mark an artifact as unread again when its content changes after it was acknowledged.

#### Scenario: Edit after reading re-flags as unread
- **WHEN** the user reads an artifact and the artifact's content later changes
- **THEN** the artifact is marked unread again

### Requirement: Change-count labels show only unread changes

Per-artifact change-count labels — the `+a −r` badge on an artifact's change-tab and the `+a −r` hint beside an artifact or change in the file list — SHALL reflect only artifacts with unacknowledged changes. When an artifact's change is acknowledged, its count labels SHALL be removed until it changes again.

#### Scenario: Reading removes the tab count badge
- **WHEN** the user acknowledges an artifact's change
- **THEN** the artifact's change-tab no longer shows its `+a −r` badge

#### Scenario: List hint shows only unread changes
- **WHEN** an artifact in the file list has no unacknowledged changes
- **THEN** no `+a −r` hint is shown beside it, and a change row shows counts only from its unread artifacts

### Requirement: Surface only the most recent change

The system SHALL retain and surface only each artifact's most recent change. It SHALL NOT store a history of prior changes or a count of how many times an artifact changed. When an artifact changes more than once, only the change from the previously observed content to the current content is shown, and the artifact's unread state is a single flag rather than a count.

#### Scenario: Multiple changes collapse to the latest change
- **WHEN** an artifact changes more than once before it is read
- **THEN** only the most recent change is shown and the artifact is marked unread once (not once per change)

#### Scenario: Reading acknowledges the latest change only
- **WHEN** the user reads an artifact that changed more than once
- **THEN** the artifact becomes read with no residual indication of its earlier changes

### Requirement: Acknowledge artifacts individually within a change

Opening a change SHALL NOT acknowledge every artifact in it. Each artifact SHALL be acknowledged only when its own content or diff view is opened.

#### Scenario: Opening one artifact does not acknowledge its siblings
- **WHEN** a change contains multiple changed artifacts and the user opens only one of them
- **THEN** the open artifact is acknowledged but the other changed artifacts remain unread

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

### Requirement: Diff control indicates unseen changes

When an artifact has a diff, the control that opens its diff view SHALL indicate whether the artifact's change is unread.

#### Scenario: Diff control shows unseen change
- **WHEN** an artifact with a diff is unread
- **THEN** the diff-view control shows an indicator that the change has not been seen

#### Scenario: Diff control clears after viewing
- **WHEN** the user opens the diff view of an unread artifact
- **THEN** the unseen-change indicator on that artifact's diff control is cleared

### Requirement: Group counters reflect unread changes

Group counters SHALL count artifacts (or changes) with unacknowledged changes, and SHALL be cleared once those changes are acknowledged. They SHALL reflect read state across reloads rather than changes made in a single session.

#### Scenario: Counter clears when changes are acknowledged
- **WHEN** the user acknowledges every changed artifact counted in a group
- **THEN** the group's counter is no longer shown

#### Scenario: Counter persists across reload until acknowledged
- **WHEN** a group contains unacknowledged changes and the user reloads the page
- **THEN** the group counter still reflects those unacknowledged changes after the reload

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

### Requirement: Cancel an in-progress folder read

While the system is reading a folder's artifacts (the initial read that happens when a folder is opened or re-opened on reload), the user SHALL be able to cancel that read. A cancel control SHALL be visible while the read is in progress, and cancelling SHALL stop the read, dismiss the reading progress indicator, and return the app to the pre-read state rather than leaving the UI blocked or showing a partial result set.

#### Scenario: Cancel control is shown during a folder read
- **WHEN** the system is reading a folder's artifacts
- **THEN** a cancel control is visible to the user while the read is in progress

#### Scenario: Cancelling stops the read and restores the pre-read state
- **WHEN** the user cancels an in-progress folder read
- **THEN** the read stops, the progress indicator is dismissed, no folder is being monitored, and the app returns to the pre-read state (as if no folder had been opened)

#### Scenario: UI is not left blocked after cancelling
- **WHEN** the user cancels an in-progress folder read
- **THEN** the app remains responsive and the user can open a folder again

#### Scenario: Opening a folder after cancel works
- **WHEN** the user cancels a folder read and then opens a folder again
- **THEN** a fresh folder read starts normally

#### Scenario: Escape key cancels the read
- **WHEN** a folder read is in progress and the user presses the Escape key
- **THEN** the read is cancelled with the same effect as activating the cancel control
