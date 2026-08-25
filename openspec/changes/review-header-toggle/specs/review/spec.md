## MODIFIED Requirements

### Requirement: Existing review behavior preserved

The system SHALL preserve the review panel's existing behaviors and integrations at viewport widths of 62em or more: the first highlight is recorded and shown in the panel, clicking a review item reveals the matching text's location in the artifact, and the panel keeps a single **Copy prompt** action that is disabled until at least one highlight has a comment. At viewport widths of 62em or more the panel SHALL be hideable and showable through the header visibility control defined by the panel-visibility capability, and the header SHALL provide that control. Hiding the panel SHALL NOT remove or disable any review behavior or data: highlights and comments added while hidden SHALL be recorded, and showing the panel again SHALL present the full review list, checklist, and actions so the user can review items, delete them, and copy the prompt. At viewport widths below 62em, none of the panel's features (review list, checklist, Copy prompt action) are available because the panel is hidden. Review items recorded while the panel is hidden SHALL be stored per folder and SHALL appear in the review panel when the view is shown at a viewport width of 62em or more.

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
- **THEN** the header shows the review panel's visibility control; activating it hides the panel, and activating it again shows the panel again with its review list, checklist, and actions intact

#### Scenario: Deletion and copy remain possible after restore
- **WHEN** the review panel was hidden at a viewport width of at least 62em and is shown again with recorded review items
- **THEN** the user can delete individual items and copy the prompt, exactly as if the panel had never been hidden

#### Scenario: Items recorded under the hidden panel resurface on wide screens
- **WHEN** the user records a review item while the viewport is narrower than 62em (or while the panel is manually hidden at 62em or more) and later views the same folder at a viewport width of at least 62em
- **THEN** the recorded item appears in the review panel

#### Scenario: No review actions on narrow screens
- **WHEN** the viewport is narrower than 62em
- **THEN** no review list, checklist, or Copy prompt action is available anywhere in the app