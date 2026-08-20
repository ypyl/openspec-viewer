## ADDED Requirements

### Requirement: Comment popup stays within the viewport

The system SHALL position the comment popup (the bubble shown when the user
selects text to add a highlight or comment) so that the entire popup is within
the visible viewport when it is first shown. The popup SHALL prefer to open just
below the selected text, but SHALL open above the selection when there is not
enough space below the anchor to fit the whole popup, and SHALL clamp within the
viewport horizontally and vertically so no part of it is off-screen. The popup
SHALL close when the user scrolls the content pane rather than remaining open in
a re-anchored or off-screen position.

#### Scenario: Popup opens below the anchor when there is room
- **WHEN** the user selects text whose anchor is high enough on screen that the
  popup can fit below it within the viewport
- **THEN** the popup is placed fully below the selected text and entirely within
  the viewport

#### Scenario: Popup flips above the anchor near the bottom of the screen
- **WHEN** the user selects text whose anchor is near the bottom of the viewport
  and there is not enough room to fit the popup below it
- **THEN** the popup is placed above the selected text, still fully within the
  viewport, so the user can see and interact with it

#### Scenario: Scrolling the pane closes the popup
- **WHEN** the user scrolls the content pane while the comment popup is open
- **THEN** the popup is dismissed, so it does not float, jump, or appear
  off-screen while the content moves
