# Spec Delta

## ADDED Requirements

### Requirement: Auto-refresh the open artifact

While a folder is active and one of its artifacts is displayed, the system SHALL track that artifact for external changes and refresh the open view when the file changes on disk. Tracking SHALL read only the displayed artifact's own file: it SHALL NOT walk the folder or read any other artifact. Only the active folder's displayed artifact is tracked; session-only uploads and folders with no displayed artifact are not tracked.

#### Scenario: An external edit refreshes the displayed artifact
- **WHEN** the displayed artifact's file changes on disk while it is shown
- **THEN** the open view shows the new content without a page reload and the artifact is flagged unread

#### Scenario: Only the displayed artifact is read
- **WHEN** an artifact that is not currently displayed changes on disk
- **THEN** the displayed view is unaffected and the folder is not walked to find the change

#### Scenario: The diff view refreshes against the previous content
- **WHEN** the displayed artifact changes on disk while its diff view is shown
- **THEN** the diff view is rebuilt against the content observed before the change

#### Scenario: Background folder changes are not tracked
- **WHEN** more than one folder is open and an artifact of a background (non-active) folder changes
- **THEN** only the active folder's displayed artifact is tracked and the background folder is left to its next read

#### Scenario: Tracking follows the displayed artifact
- **WHEN** the user displays a different artifact, or closes the displayed one
- **THEN** the newly displayed artifact is tracked and the previously displayed one is no longer tracked

#### Scenario: Uploaded folder is not tracked
- **WHEN** the active folder is a session-only upload
- **THEN** no artifact changes are tracked, since the uploaded contents do not change on disk

#### Scenario: A refreshed artifact is not reported as changed again
- **WHEN** the displayed artifact auto-refreshes and the user then activates the reload control
- **THEN** the same change is not reported as a new change a second time

#### Scenario: Refreshing does not disturb reading position
- **WHEN** the displayed artifact refreshes while the user has scrolled away from the top
- **THEN** the view updates in place without resetting the scroll position
