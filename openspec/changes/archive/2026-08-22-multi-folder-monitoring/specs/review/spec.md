## ADDED Requirements

### Requirement: Review items are scoped to the active folder

Review items (text-range highlights and whole-file comments) SHALL be stored and shown per folder. The review panel and the header's comment-count badge SHALL reflect the active folder's items only; switching folders SHALL swap the panel's contents without losing either folder's items. Items recorded before this change existed SHALL be treated as belonging to the folder that was open at the time (the migrated legacy folder) and SHALL continue to appear in it.

#### Scenario: Switching folders swaps the review panel
- **WHEN** the user switches from a folder with comments to a folder without
- **THEN** the review panel shows the second folder's items (none) and the first folder's comments remain stored

#### Scenario: Same-path artifacts keep separate review items
- **WHEN** two folders contain the same relative artifact path and the user comments on it in one folder
- **THEN** only that folder's review panel shows the comment; the other folder's panel does not

#### Scenario: Existing reviews survive in the migrated folder
- **WHEN** a user with pre-existing highlights/comments upgrades the app
- **THEN** those items appear in the folder that was open before the upgrade (restored as the legacy folder), not in any newly added folder

### Requirement: Prompt paths are folder-qualified

The copied review prompt SHALL identify each referenced file in a way that is unambiguous when more than one folder is open: paths of artifacts inside a folder's openspec root SHALL be prefixed with that folder's project name (e.g. `openspec-viewer/openspec/changes/…`), so prompts applied across repos can locate the right file.

#### Scenario: Prompt paths include the project name
- **WHEN** the user copies the review prompt while multiple folders are open
- **THEN** each listed artifact path is prefixed with the project name of the folder it belongs to

#### Scenario: Single-folder prompts keep relative paths
- **WHEN** exactly one folder is open and the user copies the review prompt
- **THEN** artifact paths keep the historical `openspec/…` relative form, with no project-name prefix