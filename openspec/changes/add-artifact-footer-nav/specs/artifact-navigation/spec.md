## Purpose

Lets a reader move straight from the end of one artifact in a change to the next artifact, without scrolling back up to the change's tab bar.

## ADDED Requirements

### Requirement: Change view presents an artifact tab bar

When a change is open, the system SHALL present that change's artifacts as a tab bar, ordered proposal, then spec deltas, then design, then tasks, then the change's metadata file. The tab bar SHALL include only artifacts the change actually contains, and one tab SHALL be active at a time showing that artifact's content. Standalone artifacts that belong to no change, such as main specs and config files, SHALL NOT show a tab bar.

#### Scenario: Tabs appear in reading order

- **WHEN** the user opens a change that has a proposal, a spec delta, a design, a task list, and a metadata file
- **THEN** the tab bar shows Proposal, then the spec delta, then Design, then Tasks, then Metadata, in that order

#### Scenario: Tabs skip artifacts the change does not contain

- **WHEN** the user opens a change that has no design
- **THEN** the tab bar shows no Design tab and the remaining tabs stay in reading order

#### Scenario: No tab bar for a standalone artifact

- **WHEN** the user opens a main spec or a config file that belongs to no change
- **THEN** no artifact tab bar is shown

### Requirement: Footer navigation at the end of an artifact

The system SHALL show a navigation row at the end of an open change's artifact content, below the artifact body, containing a Previous control and a Next control. Each control SHALL name the adjacent artifact by its tab label, so the destination is known before it is selected. The row SHALL sit in the document flow after the artifact content and SHALL NOT be pinned to the viewport, so it is reached by reading to the end of the artifact. The row SHALL be shown for archived changes as well as active ones. When the change has fewer than two artifacts, the row SHALL NOT be shown.

#### Scenario: Row follows the end of a long artifact

- **WHEN** the user reads a long proposal to its end
- **THEN** the navigation row appears after the proposal content, naming the adjacent artifacts

#### Scenario: Row names the adjacent artifacts

- **WHEN** the Design tab of a change is open and the change has a Tasks artifact after it
- **THEN** the Next control is labeled with the Tasks tab's label

#### Scenario: Archived change shows the row

- **WHEN** the user opens an archived change that has more than one artifact
- **THEN** the navigation row is shown after the artifact content

#### Scenario: Single-artifact change shows no row

- **WHEN** the user opens a change whose only artifact is one tab
- **THEN** no navigation row is shown

### Requirement: Footer control is disabled when there is no adjacent artifact

A footer control SHALL be disabled when no artifact exists in that direction. The first tab SHALL have no Previous destination and the last tab SHALL have no Next destination. Navigation SHALL NOT wrap around from the last artifact to the first or from the first to the last.

#### Scenario: First tab has no Previous

- **WHEN** the Proposal tab, the first tab of a change, is open
- **THEN** the Previous control is disabled

#### Scenario: Last tab has no Next

- **WHEN** the Metadata tab, the last tab of a change, is open
- **THEN** the Next control is disabled

#### Scenario: Navigation does not wrap

- **WHEN** the user activates the disabled Next control on the last tab
- **THEN** the active artifact does not change

### Requirement: Footer navigation switches the active artifact

Selecting a footer control SHALL open the adjacent artifact exactly as selecting that artifact's tab does: the artifact SHALL become the active tab, its content SHALL be shown in place of the previous artifact, and the content pane SHALL be scrolled to the top of the new artifact. Moving between artifacts this way SHALL NOT introduce any read/unread acknowledgment beyond what opening an artifact already does, so an artifact with an unacknowledged change stays unacknowledged until its change is actually seen.

#### Scenario: Next opens the following artifact at its top

- **WHEN** the user is at the end of the Proposal tab and selects the Next control for Design
- **THEN** the Design artifact becomes the active tab and is shown scrolled to its top

#### Scenario: Previous returns to the preceding artifact

- **WHEN** the user is on the Design tab and selects the Previous control
- **THEN** the preceding artifact becomes the active tab and is shown

#### Scenario: Acknowledgment matches tab selection

- **WHEN** the user moves to an artifact that has an unacknowledged change by selecting a footer control
- **THEN** that artifact's unacknowledged state is the same as if its tab had been selected directly
