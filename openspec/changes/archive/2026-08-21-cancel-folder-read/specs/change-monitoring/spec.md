## ADDED Requirements

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
