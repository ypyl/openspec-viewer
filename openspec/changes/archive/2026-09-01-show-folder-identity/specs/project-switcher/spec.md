## ADDED Requirements

### Requirement: Sidebar shows the opened folder's identity

The system SHALL show, in the sidebar name row alongside the active folder's project name, a short identity line that reveals where the openspec content was opened from: the pick relation (either the openspec root inside a picked repo root, or the folder itself being the openspec root), and, when known, the git origin URL and current branch. The identity SHALL be shown for every folder that has it, SHALL be restored after a reload along with the folder, and SHALL let two open folders with the same project name be told apart without having to activate either one.

#### Scenario: Repo-root pick shows the openspec relation
- **WHEN** the user opens a repo root that contains an `openspec/` subfolder
- **THEN** the sidebar name row shows the project name and an identity line indicating the content is scanned from the repo's `openspec/` subfolder

#### Scenario: Openspec-root pick shows itself as the root
- **WHEN** the user opens a folder that is itself an openspec root
- **THEN** the sidebar name row shows the project name and an identity line indicating the folder itself is the openspec root

#### Scenario: Git origin and branch are shown when known
- **WHEN** the opened repo root is a git checkout with a remote and a checked-out branch
- **THEN** the identity line also shows the origin URL and the current branch

#### Scenario: Identity distinguishes same-named folders
- **WHEN** two open folders share the same project name
- **THEN** the active folder's identity line shows its own relation and, when available, its git identity, so the two folders remain distinguishable by the identity alone

#### Scenario: Uploaded folder shows the relation only
- **WHEN** a session-only (uploaded) folder is active
- **THEN** its identity line shows the pick relation derived from its relative paths and never shows a git origin or branch

#### Scenario: Identity survives a reload
- **WHEN** the app reloads and restores the granted folders
- **THEN** each restored folder continues to show its identity line

### Requirement: Rail avatar tooltip shows the folder's identity

The system SHALL include the folder identity (pick relation and, when known, git origin and branch) in the hover tooltip of each rail avatar, so folders that are not active remain identifiable by hovering their avatar.

#### Scenario: Tooltip reveals a switched-away folder's identity
- **WHEN** the user hovers the avatar of a folder that is not active
- **THEN** the tooltip shows the folder's project name and, when known, its pick relation and git origin and branch