## ADDED Requirements

### Requirement: Review panel provides its own close control

At viewport widths of 62em or more, the review panel SHALL show a close control on the panel itself (distinct from the restore control shown while hidden) that hides the panel. Activating the close control SHALL hide the review panel exactly as a visibility toggle would — removing it from the layout so the content pane re-expands — and SHALL cause the restore control to appear. The close control SHALL be part of the panel, so it is not shown at viewport widths below 62em where the panel is hidden.

#### Scenario: Close control hides the panel from within it
- **WHEN** the viewport is at least 62em wide and the user activates the review panel's close control while the panel is visible
- **THEN** the review panel is removed from the layout, the content pane re-expands to fill the freed space, and the restore control appears

#### Scenario: Close control is absent on narrow screens
- **WHEN** the viewport is narrower than 62em
- **THEN** no review panel, and therefore no close control on it, is shown

## MODIFIED Requirements

### Requirement: Header controls hide and show side panels at desktop widths

At viewport widths of 62em or more, the system SHALL provide a header visibility control for the file list sidebar. The control SHALL toggle the sidebar between visible and hidden, SHALL indicate the current state of the sidebar, SHALL be hidden from the interface below 62em, and SHALL NOT affect the folder rail, which SHALL remain in the layout at all times. The review panel SHALL NOT have a header visibility control — it is hidden by its own close control and shown by the restore control instead. Hiding a panel SHALL remove it from the layout so the content pane re-expands to fill the freed space; showing it SHALL restore it in place. Neither panel SHALL overlap the artifact content while visible.

#### Scenario: Hiding the review panel widens the pane
- **WHEN** the viewport is at least 62em wide and the user hides the review panel with its close control while the panel is visible
- **THEN** the review panel is removed from the layout, occupying no space, and the content pane expands to fill the freed width

#### Scenario: Showing the review panel restores it in place
- **WHEN** the viewport is at least 62em wide, the review panel is hidden, and the user activates its restore control to show it
- **THEN** the review panel returns as the right-hand layout column beside the content pane, and neither the panel nor the pane overlap

#### Scenario: Sidebar hides and shows the same way
- **WHEN** the viewport is at least 62em wide and the user activates the file list's header visibility control
- **THEN** the file list sidebar is hidden (pane expands) or shown (pane narrows) accordingly, and the folder rail remains pinned

#### Scenario: Controls reflect their panel's state
- **WHEN** the viewport is at least 62em wide
- **THEN** the sidebar's header visibility control indicates whether the sidebar is currently visible or hidden, and no header control exists for the review panel (its close control is present while visible, and the restore control while hidden)

#### Scenario: Controls are absent on narrow screens
- **WHEN** the viewport is narrower than 62em
- **THEN** no panel visibility control is shown in the header