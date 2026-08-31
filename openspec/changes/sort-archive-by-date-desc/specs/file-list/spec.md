## ADDED Requirements

### Requirement: Archive changes are ordered by date, newest first

The Archive group SHALL list its archived-change rows ordered by the date encoded in the archived change's directory name, in descending order (most recent date first). An archived change whose directory name has no date prefix SHALL be listed after all dated entries. Ordering SHALL affect display order only and SHALL NOT alter which changes appear in the group, their labels, or their unread/comment markers.

#### Scenario: Newest archived change listed first

- **WHEN** the store contains archived changes with dates 2026-08-21, 2026-08-19, and 2026-08-20, and the user expands the Archive group
- **THEN** the rows appear in the order 2026-08-21 first, then 2026-08-20, then 2026-08-19

#### Scenario: Undated archived changes sort after dated ones

- **WHEN** the store contains an archived change whose directory name has no date prefix and one with a date prefix
- **THEN** the dated change is listed above the undated change

#### Scenario: Same-date entries remain deterministically ordered

- **WHEN** two archived changes share the same date
- **THEN** they appear in a stable order (by name) relative to each other