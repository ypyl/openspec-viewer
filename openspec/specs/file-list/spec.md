## Purpose

Defines how the sidebar artifact list organizes artifacts into groups (Changes, Specs, Archive, Config) and how those groups' headers collapse and expand, including the first-visit default state and persistence of the user's choice.

## Requirements

### Requirement: Group headers support expand and collapse
The sidebar SHALL present artifacts grouped under headers for Changes, Specs, Archive, and Config. Each header SHALL display its group's artifact count. Clicking a header SHALL toggle that group between expanded (items visible) and collapsed (items hidden). A collapsed group SHALL remain discoverable through its visible header and count.

#### Scenario: Collapsing a group hides its items
- **WHEN** the user clicks a group header that is expanded
- **THEN** the group's items are hidden and the header shows the collapsed state

#### Scenario: Expanding a group reveals its items
- **WHEN** the user clicks a collapsed group header
- **THEN** the group's items become visible

#### Scenario: A collapsed group still shows its count
- **WHEN** a group is collapsed and contains items
- **THEN** the header still shows the number of items in the group

### Requirement: Archive and Config are collapsed by default on first visit
On a first visit — when the user has no persisted collapse state — the Archive and Config group headers SHALL be collapsed by default, and the Changes and Specs headers SHALL be expanded.

#### Scenario: First visit shows Archive and Config collapsed
- **WHEN** a visitor opens the app with no persisted collapse state and the store contains config files
- **THEN** the Archive and Config headers are collapsed and the Changes and Specs headers are expanded

#### Scenario: A store without config files is unaffected
- **WHEN** a first-time visitor opens a store with no config.yaml or config/ directory
- **THEN** no Config header is shown and no other group is affected

### Requirement: Per-user collapse choice persists
The user's expand/collapse choice for each group SHALL be saved and restored on subsequent visits. A saved choice SHALL take precedence over the first-visit defaults. The choice SHALL be remembered per folder, so each folder restores its own group state and one folder's choice does not leak into another.

#### Scenario: Expanding a default-collapsed group persists
- **WHEN** the user expands the Config group and then reloads the app
- **THEN** the Config group is still expanded

#### Scenario: Collapsing a group persists
- **WHEN** the user collapses the Specs group and then reloads the app
- **THEN** the Specs group is still collapsed

#### Scenario: Collapse choice is per folder
- **WHEN** the user collapses the Config group in one folder and switches to another folder that had it expanded
- **THEN** the other folder still shows Config expanded, and switching back restores the collapsed Config in the first folder

### Requirement: Filtering reveals items in collapsed groups
While the user is filtering the artifact list, all groups SHALL remain expanded so matches in any group, including default-collapsed ones, are visible.

#### Scenario: Filtering shows matches in a collapsed group
- **WHEN** the user types a filter query that matches a file in the Config group while Config is collapsed
- **THEN** the Config group is expanded and the matching file is visible

### Requirement: Artifact list shows the active folder's items only

The sidebar SHALL list artifacts from the active folder only. Switching folders SHALL replace the list contents with the new active folder's artifacts (restoring that folder's own selection and open-change tabs), and no artifact from a non-active folder SHALL appear in the list, even when a non-active folder contains an artifact with the same relative path. When no folder is open, the sidebar SHALL show a no-folder empty state that points at the add action rather than an artifact list or a "no artifacts" message.

#### Scenario: Switching folder swaps the list
- **WHEN** the user switches from folder A to folder B
- **THEN** the list shows folder B's artifacts, grouped and with B's collapse state, and A's artifacts are not listed

#### Scenario: Same-path artifacts never mix
- **WHEN** folders A and B both contain a change at the same relative path
- **THEN** the list shows only the active folder's instance of that change, never both

#### Scenario: Selection restores when switching back
- **WHEN** the user switches away from a folder and back to it
- **THEN** the folder's previously selected artifact and open change tabs are restored

#### Scenario: No-folder empty state guides the user
- **WHEN** no folder is open
- **THEN** the sidebar shows a no-folder empty state that points at the add action instead of listing artifacts
