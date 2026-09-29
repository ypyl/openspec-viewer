## MODIFIED Requirements

### Requirement: Acknowledge changes as read

The system SHALL mark an artifact as read when the user has seen everything there is to see about it, or when the user explicitly acknowledges it in bulk. Opening the diff view SHALL acknowledge the artifact. Opening the artifact's content view SHALL acknowledge it only when no diff exists for it (its content view is then the only thing to see). A bulk acknowledge SHALL mark every unread artifact in the folder read against its current content, without requiring any artifact to be opened.

#### Scenario: Opening the diff view acknowledges the artifact
- **WHEN** the user opens the diff view of an artifact that has a diff
- **THEN** the artifact is marked read and its unread indication is cleared

#### Scenario: Opening a changed artifact's content does not acknowledge it
- **WHEN** the user opens the content view of an artifact that has a pending diff
- **THEN** the artifact remains unread until the diff view is opened

#### Scenario: Opening a new artifact's content acknowledges it
- **WHEN** the user opens the content view of a brand-new artifact for which no diff exists
- **THEN** the artifact is marked read and its unread indication is cleared

#### Scenario: Bulk acknowledge reads an artifact that was never opened
- **WHEN** the user acknowledges the folder's unread artifacts in bulk
- **THEN** each unread artifact is marked read even though its content view and its diff view were never opened

## ADDED Requirements

### Requirement: Mark all as read control in the sidebar

The system SHALL provide a **Mark all as read** control in the sidebar's active-folder row, positioned between the folder's name and its close control. The control SHALL acknowledge every unread artifact in the active folder in one action, and SHALL act on the active folder only. The control SHALL remain visible but unavailable when the active folder has nothing unread, so the row keeps its layout, and it SHALL report how many artifacts are currently unread. Acknowledging in bulk SHALL clear every unread indication for that folder — the list markers, the change-count labels, the group counters, the folder's unread indicator, and the open artifact's tab and diff badges — while leaving the recorded diffs themselves available to view. The acknowledged state SHALL persist as any other acknowledge does.

#### Scenario: Control sits between the folder name and the close control
- **WHEN** a folder is open in the sidebar
- **THEN** the Mark all as read control is shown between the folder's name and the folder's close control

#### Scenario: Control is unavailable when nothing is unread
- **WHEN** the active folder has no unread artifacts
- **THEN** the control is still shown but unavailable, and activating it acknowledges nothing

#### Scenario: Control reports the unread count
- **WHEN** the active folder has three unread artifacts
- **THEN** the control reports that three artifacts will be marked read

#### Scenario: One action clears every unread indication
- **WHEN** the user activates the control while several artifacts of the active folder are unread
- **THEN** the list markers, the change-count labels, the group counter, the folder's unread indicator, and the open artifact's tab and diff badges are all cleared

#### Scenario: Recorded diffs stay viewable after a bulk acknowledge
- **WHEN** the user acknowledges artifacts in bulk and then opens one of them
- **THEN** its recorded diff is still available to view

#### Scenario: Bulk acknowledge affects the active folder only
- **WHEN** another folder has unread artifacts and the user acknowledges in bulk
- **THEN** that other folder's unread artifacts stay unread

#### Scenario: Bulk-acknowledged state survives a reload
- **WHEN** the user acknowledges artifacts in bulk and then reloads the page
- **THEN** those artifacts are still read and are not re-flagged as unread
