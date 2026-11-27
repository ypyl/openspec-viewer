## ADDED Requirements

### Requirement: An applied change is badged done

A change row in the Changes group SHALL show a **done** badge next to the change name when the change's `tasks.md` exists and every task checkbox in it is checked. The badge SHALL carry the completed task count in its tooltip. The badge SHALL NOT appear for a change whose `tasks.md` has at least one unchecked task, for a change without `tasks.md`, or on any row in the Archive group. The badge SHALL be derived from file content and SHALL appear once the folder has been read, without the user opening the change.

#### Scenario: A fully checked change is badged
- **WHEN** a folder is read and a change's tasks.md lists three tasks, all checked
- **THEN** that change's row shows the done badge with a "3/3 tasks done" tooltip

#### Scenario: A change with an open task is not badged
- **WHEN** a change's tasks.md has one checked and one unchecked task
- **THEN** its row shows no done badge

#### Scenario: A change without tasks is not badged
- **WHEN** a change contains no tasks.md
- **THEN** its row shows no done badge

#### Scenario: Archived changes are not badged
- **WHEN** the Archive group is expanded
- **THEN** no archived change row shows a done badge

#### Scenario: Checking the last task badges the change on the next read
- **WHEN** the user checks the last open task in a change's tasks.md and reloads the folder
- **THEN** the change's row now shows the done badge

#### Scenario: Removing tasks.md drops the badge
- **WHEN** a badged change's tasks.md is deleted and the folder is read again
- **THEN** the change's row no longer shows the done badge

#### Scenario: The badge survives a reload that re-reads nothing
- **WHEN** a folder is re-opened with its task files unchanged
- **THEN** the done badge is restored from persisted content and still shows on the applied change's row

#### Scenario: The badge works in a session-only folder
- **WHEN** a folder is added through the upload fallback instead of the folder picker
- **THEN** an applied change in it still shows the done badge
