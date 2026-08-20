## Purpose

Lets the user collect highlighted text and comments across artifacts into a review panel, and fold them into a single LLM fix prompt. The review panel is a right-hand column of the application layout that the content pane makes room for, so the artifact under review stays visible while the panel is open.

## Requirements

### Requirement: Review panel is a layout column, not an overlay

The system SHALL render the review panel as a right-hand column that is part of the application layout rather than a fixed overlay on top of the content. When the panel is open, the content pane SHALL shrink to make room for the panel; when the panel is closed, the panel SHALL collapse to zero width and the content pane SHALL re-expand to fill the freed space. The panel SHALL NOT cover, hide, or overlap the artifact content at any point while it is open.

#### Scenario: Opening the panel shrinks the content pane
- **WHEN** the user opens the review panel with an artifact visible in the content pane
- **THEN** the content pane narrows to make room for the panel and the artifact remains fully visible beside it, without any part of the artifact being covered by the panel

#### Scenario: Closing the panel restores the content
- **WHEN** the user closes the review panel
- **THEN** the panel collapses to zero width and the content pane expands to fill the released space

#### Scenario: Panel never overlaps the artifact
- **WHEN** the panel is open
- **THEN** no portion of the rendered artifact is hidden behind the panel; the pane and the panel are side by side within the layout

### Requirement: Panel open/close shows a smooth reflow

The system SHALL animate the panel's width so that opening and closing the panel transitions smoothly, reflowing the content pane in place rather than snapping or sliding a full-height box over it. While the panel is open, the user SHALL remain able to scroll and interact with the content pane normally.

#### Scenario: Opening animates a reflow
- **WHEN** the user opens the review panel
- **THEN** the panel width and the content pane's width transition smoothly over a short duration, with no abrupt layout jump

#### Scenario: Interaction during open
- **WHEN** the review panel is open
- **THEN** the content pane remains scrollable and interactive alongside the panel

### Requirement: Usable on narrow screens

The system SHALL keep the content pane usable at viewport widths too narrow for a three-column layout (file list, content, review). At such widths, the review panel SHALL fall back to an acceptable behavior that does not permanently squeeze the artifact below a usable size; when closed at narrow widths, the content pane SHALL return to its full width.

#### Scenario: Panel falls back on narrow screens
- **WHEN** the viewport is too narrow for the file list, content, and review panel to sit side by side
- **THEN** the review panel opens without squeezing the content pane into an unusable width, or temporarily overlays it in a way that restores full width when closed

### Requirement: Existing review behavior preserved

The system SHALL preserve the review panel's existing behaviors and integrations: the header review button and its comment-count badge reflect the open state and comment count; the panel opens on its own when the user makes the first highlight; clicking a review item reveals the matching text's location in the artifact; and the panel keeps its Copy-fix and Send-to-LLM actions, both disabled until at least one comment exists. The panel SHALL remain reachable via the same open/toggle triggers regardless of whether the layout treatment or the narrow-screen fallback is active.

#### Scenario: First highlight opens the panel
- **WHEN** the user makes their first highlight without the panel already open
- **THEN** the panel opens (in whichever form matches the current viewport) and collects the new highlight

#### Scenario: Review items still reveal the comment location
- **WHEN** the user clicks a review item
- **THEN** the artifact opens (if needed) and scrolls to the text the comment refers to

#### Scenario: Actions reflect comment presence
- **WHEN** the panel holds no comments
- **THEN** the Copy-fix and Send-to-LLM actions are disabled

#### Scenario: Header button reflects open state
- **WHEN** the panel is open
- **THEN** the header review button shows its active state and clicking it closes the panel; clicking it again reopens it
