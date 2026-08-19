## Purpose

Defines how the OpenSpec Local Viewer detects and surfaces changes to OpenSpec artifacts: content-level diffs rebuilt from persisted snapshots, per-file unread/read tracking, and how that read state is acknowledged and persists across reloads.

## ADDED Requirements

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
