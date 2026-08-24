## Purpose

Provides a slide-over navigation drawer that hides the folder rail and the artifact list behind a header toggle on narrow screens, so the content pane gets full width while browsing on a phone.

## ADDED Requirements

### Requirement: Navigation panels collapse into a slide-over drawer on narrow screens

On viewport widths below the md breakpoint (62em), the system SHALL hide the folder rail and the artifact list behind a slide-over navigation drawer rather than laying them out as on-screen panels. The drawer SHALL slide in from the left edge and overlay the app, and while the drawer is closed the content pane SHALL span the full viewport width. At viewport widths of 62em or more, the system SHALL NOT show the drawer or any mobile-only toggle, and SHALL keep the folder rail and artifact list in place as fixed layout panels.

#### Scenario: Narrow screen hides the panels behind the drawer
- **WHEN** the viewport is narrower than 62em
- **THEN** the folder rail and the artifact list are not visible in the page layout and the content pane spans the full viewport width

#### Scenario: Desktop layout is unchanged
- **WHEN** the viewport is at least 62em wide
- **THEN** the folder rail and the artifact list remain in place as layout panels, no drawer or mobile-only toggle is shown, and no mobile-specific control appears

### Requirement: Header toggle opens and closes the drawer

The system SHALL provide a menu toggle in the app header, visible only below 62em, that opens the drawer when it is closed and closes it when it is open. The toggle SHALL expose the drawer's open state through its accessible name or state.

#### Scenario: Toggle opens the drawer
- **WHEN** the viewport is narrower than 62em and the user activates the header menu toggle while the drawer is closed
- **THEN** the drawer slides in and the toggle reflects the open state

#### Scenario: Toggle closes the drawer
- **WHEN** the user activates the header menu toggle while the drawer is open
- **THEN** the drawer slides out and the content pane returns to full width

### Requirement: Drawer closes via Escape, backdrop, or close button

While the drawer is open, the system SHALL close it when the user presses Escape, clicks the backdrop area outside the drawer panel, or activates the close button inside the drawer. Closing SHALL NOT change the active folder, the artifact selection, the sidebar scroll position, group collapse state, or the set of open tabs.

#### Scenario: Escape closes the drawer
- **WHEN** the drawer is open and the user presses Escape
- **THEN** the drawer closes and the current folder and selection are unchanged

#### Scenario: Backdrop click closes the drawer
- **WHEN** the drawer is open and the user clicks the backdrop area outside the panel
- **THEN** the drawer closes and no panel item is activated

#### Scenario: Close button closes the drawer
- **WHEN** the drawer is open and the user activates its close button
- **THEN** the drawer closes and the content pane returns to full width

### Requirement: Picking an item closes the drawer

The system SHALL close the drawer automatically when the user picks a folder, an artifact, or a change from inside it, and SHALL show the picked item in the content pane. Opening and closing the drawer SHALL NOT rebuild the panel contents: the sidebar selection, group collapse state, scroll position, and open tabs SHALL survive repeated open/close cycles.

#### Scenario: Picking a file closes the drawer and shows the file
- **WHEN** the drawer is open and the user clicks an artifact row inside it
- **THEN** the drawer closes, the artifact opens in the content pane, and the row shows the selected state

#### Scenario: Picking a folder closes the drawer and switches the view
- **WHEN** the drawer is open and the user clicks a folder avatar inside it
- **THEN** the drawer closes and the view switches to that folder

#### Scenario: Reopening the drawer keeps prior state
- **WHEN** the user opens the drawer, browses, closes it, and opens it again
- **THEN** the artifact list shows the same selection, group collapse state, and scroll position as before