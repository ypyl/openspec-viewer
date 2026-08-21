## MODIFIED Requirements

### Requirement: Detect content changes

The system SHALL detect when an artifact's content changed since the last scan and surface a content-level diff showing the added and removed lines relative to the previously observed content. Artifacts whose content is unchanged SHALL show no diff. Detection is scoped per folder: each folder's artifacts are diffed against that folder's own previously observed content, and an artifact path from one folder SHALL NOT affect another folder's detection even when the path is identical.

#### Scenario: Unchanged artifact shows no diff
- **WHEN** an artifact's content is identical to the previously observed content
- **THEN** the artifact is not treated as changed and no diff is available for it

#### Scenario: Changed artifact shows a diff
- **WHEN** an artifact's content differs from the previously observed content
- **THEN** the system surfaces a unified diff of the change, and the diff persists across the page being reloaded

#### Scenario: Identical paths in two folders do not interfere
- **WHEN** two folders both contain an artifact with the same relative path and only one of them changes
- **THEN** only the changed folder's artifact shows a diff and the other folder's artifact is unaffected

### Requirement: Track unread state per artifact

The system SHALL track, per artifact, whether the artifact has changes the user has not yet acknowledged ("unread"). An artifact SHALL be unread when it has changed since it was last acknowledged, and SHALL be unread when it has never been acknowledged. An unread artifact SHALL be visually indicated in the file/change list so the user can find it. Unread state is tracked per folder: an artifact's unread state in one folder SHALL NOT affect an identically-named artifact in another folder.

#### Scenario: Artifact with pending changes is unread
- **WHEN** an artifact has changed and the user has not acknowledged that change
- **THEN** the artifact is marked unread in the list

#### Scenario: Never-acknowledged new artifact is unread
- **WHEN** a new artifact appears that has no previous content baseline and has not been acknowledged
- **THEN** the artifact is marked unread in the list

#### Scenario: Read artifact is not marked unread
- **WHEN** an artifact has no unacknowledged changes
- **THEN** the artifact is not marked unread in the list

#### Scenario: Same relative path is tracked independently per folder
- **WHEN** two folders contain the same relative artifact path and the user reads it in one folder
- **THEN** the artifact remains unread in the other folder until acknowledged there

### Requirement: Persist read state across reloads

The system SHALL persist each artifact's read state so it survives page reloads. A reload SHALL NOT re-mark artifacts that were already acknowledged as unread, and SHALL keep genuinely unacknowledged artifacts unread. Read state SHALL be persisted per folder and SHALL survive reloads independently for each folder that is re-opened.

#### Scenario: Read state survives reload
- **WHEN** the user acknowledges an artifact and then reloads the page
- **THEN** the artifact remains read and is not re-flagged as unread

#### Scenario: Unread state survives reload
- **WHEN** an artifact has unacknowledged changes and the user reloads the page
- **THEN** the artifact is still marked unread after the reload

#### Scenario: Read state survives reload per folder
- **WHEN** the user acknowledges an artifact in one folder and reloads, with all folders restored
- **THEN** that folder's artifact remains read and every other restored folder keeps its own read state

### Requirement: Cancel an in-progress folder read

While the system is reading a folder's artifacts (the initial read that happens when a folder is added or re-opened on reload), the user SHALL be able to cancel that read. A cancel control SHALL be visible while the read is in progress, and cancelling SHALL stop the read, dismiss the reading progress indicator, and leave no partially-read folder behind: when the cancelled read belonged to a folder being added, that folder SHALL NOT appear in the rail, SHALL NOT be monitored, and SHALL NOT be persisted for reload; when it belonged to a folder being re-opened on reload, that folder SHALL NOT be re-opened and SHALL NOT be persisted for reload.

#### Scenario: Cancel control is shown during a folder read
- **WHEN** the system is reading a folder's artifacts
- **THEN** a cancel control is visible to the user while the read is in progress

#### Scenario: Cancelling stops the read and restores the pre-read state
- **WHEN** the user cancels an in-progress folder read
- **THEN** the read stops, the progress indicator is dismissed, no folder entry is added (or re-opened, on reload), and the app returns to the state that existed before the read began (as if the folder had not been opened)

#### Scenario: Cancelling an add leaves no folder behind
- **WHEN** the user cancels the initial read of a folder being added
- **THEN** the read stops, the progress indicator is dismissed, no folder entry is added to the rail, and the app stays on the previously active folder

#### Scenario: Cancelling a reload does not re-open the folder later
- **WHEN** the user cancels the initial read of a folder being re-opened on reload
- **THEN** the folder is not re-opened and is not persisted, so a later reload does not attempt it again

#### Scenario: UI is not left blocked after cancelling
- **WHEN** the user cancels an in-progress folder read
- **THEN** the app remains responsive and the user can open a folder again

#### Scenario: Opening a folder after cancel works
- **WHEN** the user cancels a folder read and then opens a folder again
- **THEN** a fresh folder read starts normally

#### Scenario: Escape key cancels the read
- **WHEN** a folder read is in progress and the user presses the Escape key
- **THEN** the read is cancelled with the same effect as activating the cancel control

## ADDED Requirements

### Requirement: Folders are monitored independently

Each opened folder SHALL be live-monitored independently of every other folder, whether or not it is the active folder. When a non-active folder's artifacts change, the system SHALL surface the change with a notice that names the folder, so the user can tell which project produced it; the active folder's changes SHALL be reported as before, without naming the folder. A background folder's detected changes SHALL also update that folder's unread state so the folder's rail avatar can indicate them.

#### Scenario: Background folder changes are reported with its name
- **WHEN** a folder that is not active gains artifact changes during monitoring
- **THEN** a notice appears that names that folder (e.g. "llmclip: 3 artifacts updated") and the folder's rail avatar shows the unread indicator

#### Scenario: Active folder changes are reported without a name
- **WHEN** the active folder's artifacts change during monitoring
- **THEN** the notice reports the change as before, without naming the folder

#### Scenario: Background monitoring keeps running across switches
- **WHEN** the user switches active folders repeatedly over several poll cycles
- **THEN** every folder continues to be scanned on its own schedule and its changes are detected

### Requirement: Closing a folder deletes its persisted state

When a folder is closed, the system SHALL delete the folder's persisted content snapshots and its persisted folder entry, so no orphaned data remains and the folder cannot be restored later. Closing a folder SHALL NOT delete or alter the data of any other open folder.

#### Scenario: Closing a folder removes its snapshots
- **WHEN** the user closes a folder that has persisted content snapshots
- **THEN** those snapshots are deleted and the folder's entry is removed from persistence

#### Scenario: Closing one folder leaves the others intact
- **WHEN** the user closes one of several open folders
- **THEN** the other folders' snapshots and read state remain untouched