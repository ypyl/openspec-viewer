## Purpose

Covers app-level UI furniture that is not part of a feature area — global chrome like the GitHub repository link in the folder rail.

## Requirements

### Requirement: GitHub link in the folder rail

The system SHALL display a link to the project's GitHub repository at the bottom of the folder rail (the left-side icon column), visually consistent with the rail's add-folder button: the same size and shape, dashed border, and hover treatment, with the GitHub mark icon as its only visible content. The link SHALL be always visible regardless of how many folders are open, SHALL NOT show folder-related indicators (unread dots, active ring, letters), and SHALL be an anchor to `https://github.com/ypyl/openspec-viewer`.

#### Scenario: Link is shown at the bottom of the rail
- **WHEN** the app is loaded with any number of folders open (including none)
- **THEN** the folder rail shows a GitHub-mark link button at its bottom, styled like the rail's add button but containing the GitHub mark

#### Scenario: Link follows the rail layout on narrow screens
- **WHEN** the viewport is narrow and the folder rail renders as a horizontal strip
- **THEN** the GitHub link appears at the end of that strip and remains clickable

### Requirement: Link opens the repository in a new tab

The system SHALL open `https://github.com/ypyl/openspec-viewer` in a new browser tab when the user activates the GitHub link, and SHALL expose the link's purpose in a non-visible label (tooltip and/or accessibility name) so assistive technology and hover reveal what it points to.

#### Scenario: Activating the link opens the repository
- **WHEN** the user clicks or keyboard-activates the GitHub link
- **THEN** a new browser tab opens at `https://github.com/ypyl/openspec-viewer` and the current app page is left in place

#### Scenario: The link's purpose is labelled
- **WHEN** the user hovers over the GitHub link or an assistive technology inspects it
- **THEN** a label such as "OpenSpec Viewer on GitHub" is available for the link