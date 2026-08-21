## Purpose

Defines how the sidebar artifact list organizes artifacts into groups (Changes, Specs, Archive, Config) and how those groups' headers collapse and expand, including the first-visit default state and persistence of the user's choice.

## ADDED Requirements

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
The user's expand/collapse choice for each group SHALL be saved and restored on subsequent visits. A saved choice SHALL take precedence over the first-visit defaults.

#### Scenario: Expanding a default-collapsed group persists
- **WHEN** the user expands the Config group and then reloads the app
- **THEN** the Config group is still expanded

#### Scenario: Collapsing a group persists
- **WHEN** the user collapses the Specs group and then reloads the app
- **THEN** the Specs group is still collapsed

### Requirement: Filtering reveals items in collapsed groups
While the user is filtering the artifact list, all groups SHALL remain expanded so matches in any group, including default-collapsed ones, are visible.

#### Scenario: Filtering shows matches in a collapsed group
- **WHEN** the user types a filter query that matches a file in the Config group while Config is collapsed
- **THEN** the Config group is expanded and the matching file is visible
