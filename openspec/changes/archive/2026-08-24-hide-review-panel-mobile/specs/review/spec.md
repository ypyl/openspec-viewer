## MODIFIED Requirements

### Requirement: Usable on narrow screens

At viewport widths below the md breakpoint (62em), the system SHALL hide the review panel entirely rather than laying it out as an on-screen panel: the panel SHALL occupy no space in the page layout (neither as a side column nor as a section below the content), SHALL NOT be revealed by any control, and SHALL NOT render its review list, checklist, or actions. The content pane SHALL span the full viewport width at such widths. At viewport widths of 62em or more, the review panel SHALL remain visible as the reserved right-hand layout column.

#### Scenario: Panel falls back on narrow screens
- **WHEN** the viewport is narrower than 62em and an artifact is open in the content pane
- **THEN** the review panel falls back to being absent from the layout: it occupies no space, shows no list, checklist, or actions, and the content pane spans the full viewport width

#### Scenario: Narrow screen hides the review panel
- **WHEN** the viewport is narrower than 62em
- **THEN** no review panel, review list, checklist, or review actions are visible and the content pane spans the full viewport width with no reserved review space below or beside it

#### Scenario: No control reveals the panel on narrow screens
- **WHEN** the viewport is narrower than 62em and the user activates any control in the app
- **THEN** the review panel is not shown in any form, overlay, or drawer

#### Scenario: Desktop layout is unchanged
- **WHEN** the viewport is at least 62em wide and an artifact is open
- **THEN** the review panel remains in place as the right-hand layout column with its review list, checklist, and actions

### Requirement: Existing review behavior preserved

The system SHALL preserve the review panel's existing behaviors and integrations at viewport widths of 62em or more: the first highlight is recorded and shown in the panel, clicking a review item reveals the matching text's location in the artifact, and the panel keeps a single **Copy prompt** action that is disabled until at least one highlight has a comment. The header SHALL NOT provide a review control: the panel's visible state is not reflected by and is not toggled from the header, because the panel is always in the layout at 62em or more. At viewport widths below 62em, none of the panel's features (review list, checklist, Copy prompt action) are available because the panel is hidden. Review items recorded while the panel is hidden SHALL be stored per folder and SHALL appear in the review panel when the view is shown at a viewport width of 62em or more.

#### Scenario: First highlight opens the panel
- **WHEN** the user makes their first highlight at a viewport width of at least 62em
- **THEN** the highlight is collected and shown in the review panel; at a viewport width below 62em the highlight is still recorded but the panel remains hidden

#### Scenario: Review items still reveal the comment location
- **WHEN** the viewport is at least 62em wide and the user clicks a review item
- **THEN** the artifact opens (if needed) and scrolls to the text the comment refers to

#### Scenario: Actions reflect comment presence
- **WHEN** the panel holds no comments
- **THEN** the Copy prompt action is disabled

#### Scenario: Header button reflects open state
- **WHEN** the viewport is at least 62em wide and an artifact is open
- **THEN** the header shows no review toggle or badge, because the review panel is always visible in the layout and has no header control; no header control opens, closes, or reopens it

#### Scenario: Items recorded under the hidden panel resurface on wide screens
- **WHEN** the user records a review item while the viewport is narrower than 62em and later views the same folder at a viewport width of at least 62em
- **THEN** the recorded item appears in the review panel

#### Scenario: No review actions on narrow screens
- **WHEN** the viewport is narrower than 62em
- **THEN** no review list, checklist, or Copy prompt action is available anywhere in the app