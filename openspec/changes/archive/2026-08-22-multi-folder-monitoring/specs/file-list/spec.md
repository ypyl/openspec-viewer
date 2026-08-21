## MODIFIED Requirements

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

## ADDED Requirements

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