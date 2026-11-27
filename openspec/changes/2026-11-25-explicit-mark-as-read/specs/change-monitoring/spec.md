## RENAMED Requirements

- FROM: `### Requirement: Opening an archived change acknowledges all its artifacts`
- TO: `### Requirement: Opening an archived change acknowledges nothing`

## MODIFIED Requirements

### Requirement: Acknowledge changes as read

The system SHALL mark an artifact as read only when the user explicitly acknowledges it: through the mark-as-read control on the artifact's own list row, on the row of the change that contains it, or on the active folder. Viewing SHALL NOT acknowledge anything. Opening an artifact's content view, opening its diff view, switching between a change's tabs, navigating with the footer controls, and opening a change (active or archived) SHALL all leave read state exactly as it was. Acknowledging SHALL mark the artifact read against its current content.

#### Scenario: Opening the diff view leaves the artifact unread
- **WHEN** the user opens the diff view of an unread artifact
- **THEN** the artifact remains unread with its unread indication and change-count labels intact

#### Scenario: Opening an artifact's content leaves it unread
- **WHEN** the user opens the content view of a changed or brand-new unread artifact
- **THEN** the artifact remains unread

#### Scenario: Opening a change leaves its artifacts unread
- **WHEN** the user opens a change whose artifacts are unread
- **THEN** each unread artifact of that change stays unread

#### Scenario: Explicit acknowledge reads an artifact that was never opened
- **WHEN** the user acknowledges an artifact through a list control or the folder's bulk control
- **THEN** the artifact is marked read even though its content view and its diff view were never opened

### Requirement: Acknowledge artifacts individually within a change

Opening a change SHALL NOT acknowledge every artifact in it. Each artifact SHALL be acknowledged only through an explicit acknowledge: its own list row control, the control on the row of the change that contains it, or the folder's bulk control.

#### Scenario: Opening one artifact does not acknowledge its siblings
- **WHEN** a change contains multiple changed artifacts and the user opens one of them
- **THEN** every artifact of that change, including the one opened, stays unread

#### Scenario: One artifact's row control leaves its siblings unread
- **WHEN** the user acknowledges one artifact of a change through its own row control while a sibling artifact is also unread
- **THEN** that artifact is marked read and the sibling stays unread

### Requirement: Opening an archived change acknowledges nothing

The system SHALL acknowledge every artifact of an archived change only when the user explicitly acknowledges it — through the change's own row control, an individual artifact row, or the folder's bulk control. Opening an archived change or any artifact within it SHALL NOT acknowledge anything. An archived change's row control SHALL mark each of its artifacts read against its current content in one step, clear the Archive group counter for that change, and persist so the change stays read across reloads.

#### Scenario: Opening an archived change clears no unread markers
- **WHEN** the user opens an archived change whose artifacts carry individual unread markers
- **THEN** every artifact of that change stays unread and the Archive group counter is unchanged

#### Scenario: The archived change's row control clears all unread markers at once
- **WHEN** the user activates the mark-as-read control on an archived change's row
- **THEN** every artifact of that change is marked read and its unread marker and diff counts are cleared without needing to open each one

#### Scenario: Archive group counter clears on acknowledge
- **WHEN** the user acknowledges an archived change whose artifacts were counting toward the Archive group counter
- **THEN** the Archive group counter no longer includes that change's artifacts

#### Scenario: Acknowledged state is persistent across reloads
- **WHEN** the user acknowledges an archived change and then reloads the app
- **THEN** the archived change's artifacts remain read

#### Scenario: A newer change after acknowledging stays unread
- **WHEN** an artifact of an acknowledged archived change changes again
- **THEN** that artifact is flagged unread again

## ADDED Requirements

### Requirement: Mark as read control per change

The sidebar's change list SHALL show a mark-as-read control on every change row that has at least one unread artifact, both for active changes and for archived ones. Activating it SHALL acknowledge every unread artifact of that change in one action, whether or not that change is open, and SHALL NOT open or navigate to the change. The control SHALL disappear from the row once the change has nothing unread left, so only rows with something to acknowledge carry it.

#### Scenario: One action clears the change's unread markers
- **WHEN** a change has several unread artifacts and the user activates that change's mark-as-read control
- **THEN** every unread artifact of that change is marked read and the change row loses its unread marker and change-count hint

#### Scenario: Other changes are untouched
- **WHEN** the user activates one change's mark-as-read control while another change is also unread
- **THEN** the other change keeps its unread marker

#### Scenario: Activating the control does not open the change
- **WHEN** the user activates the mark-as-read control on a change row that is not open
- **THEN** that change's artifacts are acknowledged and the previously open artifact stays open

#### Scenario: The control is absent on a fully read change
- **WHEN** a change row has no unread artifacts
- **THEN** that row shows no mark-as-read control

### Requirement: Mark as read control per artifact

The sidebar's artifact rows that are not change rows (specs and config files) SHALL show a mark-as-read control on every unread row. Activating it SHALL acknowledge that artifact alone, leaving every other unread artifact unread.

#### Scenario: A changed spec is acknowledged on its own
- **WHEN** the user activates the mark-as-read control on an unread spec row
- **THEN** that spec is marked read and its row loses its unread marker, while other unread specs stay unread
