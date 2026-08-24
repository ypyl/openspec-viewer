## ADDED Requirements

### Requirement: Folder rail is presented inside the navigation drawer on narrow screens

On viewport widths below 62em, the system SHALL present the folder rail inside the slide-over navigation drawer instead of as an on-screen layout panel: the avatars, the add action, and the GitHub link SHALL remain available inside the drawer, with the active folder highlighted as on desktop. Choosing a folder from the drawer SHALL close the drawer and make that folder active.

#### Scenario: Rail affordances are available inside the drawer
- **WHEN** the viewport is narrower than 62em and the user opens the navigation drawer with folders open
- **THEN** the drawer shows the folder avatars (active one highlighted), the add action, and the GitHub link

#### Scenario: Choosing a folder from the drawer closes it
- **WHEN** the viewport is narrower than 62em and the user clicks a folder avatar inside the drawer
- **THEN** the drawer closes, that folder becomes active, and the view switches to it