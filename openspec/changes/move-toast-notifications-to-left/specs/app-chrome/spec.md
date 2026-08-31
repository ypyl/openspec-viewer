## ADDED Requirements

### Requirement: Toast notifications render in the bottom-left corner

The system SHALL render transient toast notifications in the bottom-left corner of the viewport, offset so they do not overlap the left folder rail when it is present as a full-height column (viewports of 62em or more). Opening or closing the review panel SHALL NOT move or obscure the toasts. Toasts SHALL otherwise behave as before: one at a time, auto-dismissing after a few seconds, with error styling for error toasts.

#### Scenario: Toast appears in the bottom-left corner

- **WHEN** the app triggers a toast notification
- **THEN** the toast appears in the bottom-left corner of the viewport, not the bottom-right

#### Scenario: Toast clears the left folder rail

- **WHEN** the viewport is 62em or wider, the folder rail is visible as a full-height column, and a toast is shown
- **THEN** the toast is positioned to the right of the folder rail so nothing of the toast overlaps the rail

#### Scenario: Review drawer does not displace the toast

- **WHEN** the review panel is open and a toast is shown
- **THEN** the toast remains in the bottom-left corner in the same position it would occupy with the review panel closed