## Purpose

Lets the user open and switch between multiple OpenSpec folders (projects) at once, each shown as an avatar in a narrow left rail, and restores the set of opened folders across reloads.

## Requirements

### Requirement: Folder rail lists opened folders

The system SHALL show a narrow folder rail to the left of the sidebar artifact list, containing one avatar button per opened folder. Each avatar SHALL display the first letter of the project name (the name of the folder that contains the openspec root), with the full project name available on hover, and SHALL be distinct from other avatars (a per-folder color even when letters coincide). The avatar of the currently active folder SHALL be visually highlighted. Clicking an avatar SHALL make that folder active (switch the view to it). Folders SHALL appear in the order they were added.

#### Scenario: Rail shows one avatar per opened folder
- **WHEN** three folders are open
- **THEN** the rail shows three avatars, each with the first letter of its project name and the full name on hover

#### Scenario: Clicking an avatar switches the active folder
- **WHEN** the user clicks the avatar of a folder that is not active
- **THEN** that folder becomes active and the rest of the view switches to it

#### Scenario: Same-letter folders remain distinguishable
- **WHEN** two open folders have project names starting with the same letter
- **THEN** their avatars are visually distinct (different colors) and each tooltip shows its full name

### Requirement: Add a folder from the rail

The rail SHALL provide an add action (a `+` icon at its top) that opens a folder picker and starts monitoring the selected openspec root. When the File System Access API is unavailable, the same action SHALL fall back to a folder-upload control. Adding a folder SHALL NOT reset or disturb any already-open folder. Picking a folder that is already open SHALL NOT add a duplicate; it SHALL switch to the existing entry instead. Two different folders whose project names collide SHALL be shown with a distinguishing suffix (e.g. a `#2`) in addition to their distinct avatar colors.

#### Scenario: Plus action opens the folder picker
- **WHEN** the user activates the `+` icon
- **THEN** a folder picker opens and the picked openspec root is added to the rail and monitored

#### Scenario: Same folder picked twice switches instead of duplicating
- **WHEN** the user picks a folder that is already open
- **THEN** no duplicate entry appears and that folder becomes active

#### Scenario: Name collision is disambiguated
- **WHEN** two different open folders have the same project name
- **THEN** the second one is shown with a distinguishing suffix wherever the name is displayed

#### Scenario: Existing folders are unaffected by an add
- **WHEN** the user adds a new folder while others are open and monitored
- **THEN** the previously open folders keep their state and continue being monitored

### Requirement: Close the active folder from the rail's name row

Beside the sidebar artifact list, the system SHALL show a row with the active folder's project name and a small square close button. The name SHALL be truncated with the full name available on hover. Activating the close button SHALL close (forget) the active folder: it SHALL be removed from the rail, its monitored state SHALL be discarded, and the folder SHALL NOT reappear in a later session. The folder next below the closed one in the rail SHALL become active; when the closed folder was the only one, the app SHALL return to the no-folder state.

#### Scenario: Close button forgets the active folder
- **WHEN** the user activates the close button next to the active folder's name
- **THEN** the folder is removed from the rail, its state is discarded, and it is not restored on a later reload

#### Scenario: Next folder down becomes active
- **WHEN** the user closes the active folder and other folders remain
- **THEN** the folder immediately below the closed one in the rail becomes active and the view switches to it

#### Scenario: Closing the last folder returns to the empty state
- **WHEN** the user closes the only open folder
- **THEN** the rail shows no folder entries and the app shows its no-folder empty state

#### Scenario: Name truncates with full name on hover
- **WHEN** the active folder's project name is longer than the name row
- **THEN** the row shows the name truncated and the full name is available on hover

### Requirement: Folder avatars indicate unread changes

The system SHALL mark a folder avatar with a small indicator when that folder's artifacts have unacknowledged changes. The indicator SHALL disappear once all of that folder's changes are acknowledged, and SHALL NOT appear for session-only (uploaded) folders. The indicator SHALL reflect changes detected while the folder is not active, so the rail doubles as a monitoring surface.

#### Scenario: Dot appears for a folder with unread changes
- **WHEN** a folder gains unacknowledged changes while it is not the active folder
- **THEN** its avatar shows the unread indicator and the change notice names the folder

#### Scenario: Dot clears when changes are acknowledged
- **WHEN** the user acknowledges all of a folder's unread changes
- **THEN** the folder's avatar no longer shows the unread indicator

#### Scenario: Uploaded folders never show the indicator
- **WHEN** a session-only (uploaded) folder has content the user has not opened
- **THEN** its avatar shows no unread indicator

### Requirement: Reload restores all granted folders

On reload, the system SHALL re-open every folder that was open before and whose permission is still granted, resuming live monitoring for each. If multiple restored folders have changes since the last visit, the system SHALL show ONE aggregated notice naming those folders rather than a separate notice per folder. Folders whose permission is no longer granted SHALL be listed in the notice as skipped and SHALL NOT be re-opened.

#### Scenario: All granted folders re-open on reload
- **WHEN** the user reloads with three granted folders open
- **THEN** all three re-open, resume monitoring, and appear in the rail

#### Scenario: Changes since last visit are reported once
- **WHEN** two restored folders each changed since the last visit
- **THEN** a single notice names both folders instead of showing two notices

#### Scenario: Revoked-permission folders are skipped and reported
- **WHEN** a previously open folder's permission is no longer granted on reload
- **THEN** the folder is not re-opened and is mentioned as skipped in the aggregated notice

### Requirement: Uploaded folders are session-only rail entries

A folder added through the file-upload fallback SHALL appear in the rail with a visually distinct avatar (e.g. a hollow ring), SHALL NOT be live-monitored, SHALL NOT show an unread indicator, and SHALL NOT be restored on reload. Closing it SHALL behave like closing any other folder.

#### Scenario: Uploaded folder is marked session-only
- **WHEN** a folder is added via upload
- **THEN** it appears in the rail with a session-only marker, no unread indicator, and is not restored on reload

#### Scenario: Uploaded folder closes normally
- **WHEN** the user closes a session-only folder
- **THEN** it is removed from the rail and the next folder becomes active, as with any other folder

### Requirement: Group collapse state is remembered per folder

The system SHALL keep the sidebar's group collapse state per folder, so switching folders restores each folder's own collapse state and one folder's choice does not leak into another. The user's choice SHALL survive reloads.

#### Scenario: Collapse state is independent per folder
- **WHEN** the user collapses the Config group in one folder and switches to another folder
- **THEN** the other folder shows its own collapse state, not the collapsed Config from the first


#### Scenario: Collapse choice survives reload per folder
- **WHEN** the user sets a folder's collapsed groups and then reloads with that folder restored
- **THEN** that folder restores its own collapse state

### Requirement: Folder rail is presented inside the navigation drawer on narrow screens

On viewport widths below 62em, the system SHALL present the folder rail inside the slide-over navigation drawer instead of as an on-screen layout panel: the avatars, the add action, and the GitHub link SHALL remain available inside the drawer, with the active folder highlighted as on desktop. Choosing a folder from the drawer SHALL close the drawer and make that folder active.

#### Scenario: Rail affordances are available inside the drawer
- **WHEN** the viewport is narrower than 62em and the user opens the navigation drawer with folders open
- **THEN** the drawer shows the folder avatars (active one highlighted), the add action, and the GitHub link

#### Scenario: Choosing a folder from the drawer closes it
- **WHEN** the viewport is narrower than 62em and the user clicks a folder avatar inside the drawer
- **THEN** the drawer closes, that folder becomes active, and the view switches to it

