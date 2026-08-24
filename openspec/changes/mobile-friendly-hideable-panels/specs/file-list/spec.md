## ADDED Requirements

### Requirement: Artifact list is presented inside the navigation drawer on narrow screens

On viewport widths below 62em, the system SHALL present the artifact list inside the slide-over navigation drawer instead of as an on-screen layout panel: grouping, filtering, group collapse state, unread markers, and review comment counts SHALL behave as on desktop. Choosing an artifact or a change from the drawer SHALL close the drawer and open the picked item in the content pane.

#### Scenario: List features work inside the drawer
- **WHEN** the viewport is narrower than 62em and the user opens the navigation drawer
- **THEN** the drawer shows the artifact list with its groups, collapse state, artifact counts, unread markers, and comment counts

#### Scenario: Choosing an artifact closes the drawer and opens it
- **WHEN** the viewport is narrower than 62em and the user clicks an artifact or change row inside the drawer
- **THEN** the drawer closes and the picked artifact is shown in the content pane