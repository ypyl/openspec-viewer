## ADDED Requirements

### Requirement: Review guidance strip on active change artifact tabs

The system SHALL show a review-guidance strip directly above an active change's artifact content, between the tab bar and the content, when the opened artifact is a proposal, a spec delta, a design, or a task list. The strip SHALL present the guiding question for that artifact's kind (for example, for a proposal, whether the proposal matches what the user actually asked for). The strip SHALL NOT appear for a change's metadata file, for archived changes, for main specs, or for config files.

#### Scenario: Strip appears on a proposal tab
- **WHEN** the user opens the Proposal tab of an active change
- **THEN** a guidance strip is shown above the proposal's content presenting the proposal-specific guiding question

#### Scenario: No strip on the metadata tab
- **WHEN** the user opens the Metadata tab of an active change
- **THEN** no guidance strip is shown above the metadata content

#### Scenario: No strip for archived changes or main specs
- **WHEN** the user opens an archived change or a main spec outside any change
- **THEN** no guidance strip is shown

#### Scenario: Guidance renders without network access
- **WHEN** the user opens a change artifact while the app has no network connection
- **THEN** the guidance strip still renders its question and red flags

### Requirement: Strip expands to reveal red flags and remembers expand state

The system SHALL make the guidance strip collapsible: when collapsed it SHALL show only the guiding question; when expanded it SHALL additionally show that artifact kind's review red flags (for example, for a proposal: a different problem than asked for, scope creep, or vagueness). The expanded/collapsed choice SHALL persist across tab switches within the session, consistently across tabs of the same artifact kind: expanding the strip on one spec tab SHALL leave it expanded when the user moves to another spec tab.

#### Scenario: Expanding the strip reveals red flags
- **WHEN** the user expands the guidance strip on a spec tab
- **THEN** the strip shows the spec review red flags in addition to the guiding question

#### Scenario: Expand state carries across same-kind tabs
- **WHEN** the user expands the strip on one spec tab and switches to another spec tab of the same change
- **THEN** the strip is still expanded, showing the spec red flags

### Requirement: Proposal strip warns to stop on a wrong proposal

The proposal strip, when expanded, SHALL include guidance based on the official review method: when the proposal does not match what the user asked for, the user should stop and fix the proposal before reviewing further artifacts.

#### Scenario: Expanded proposal strip contains the stop hint
- **WHEN** the user expands the guidance strip on a Proposal tab
- **THEN** the strip states that a wrong proposal should be fixed before moving on to the other artifacts

### Requirement: Two-minute checklist in the review panel

The system SHALL show, at the top of the review panel above the collected comments, a seven-item review checklist drawn from the official review method, where each item is independently checkable and a progress count shows how many of the seven items are checked. The checklist SHALL be shown while an active change's artifact is open and SHALL NOT be shown for standalone artifacts, main specs, or archived changes.

#### Scenario: Checklist appears with seven items on a change
- **WHEN** an active change's artifact is open and the review panel is visible
- **THEN** the panel shows seven checkable review items with a progress count

#### Scenario: Checking an item updates the progress count
- **WHEN** the user checks two of the seven checklist items
- **THEN** the progress count reflects two of seven checked

#### Scenario: No checklist outside a change
- **WHEN** the user opens a main spec or an archived change while the review panel is visible
- **THEN** the panel shows no checklist section

### Requirement: Checklist state is session-scoped per change

The system SHALL keep each change's checklist ticks in memory for the browser session only: switching between changes SHALL keep each change's own ticks and restore them when switching back; switching folders or reloading the page SHALL clear all checklist ticks. Checklist state SHALL NOT be written to persistent storage.

#### Scenario: Ticks survive switching between changes
- **WHEN** the user ticks several items on change A, switches to change B, then switches back to change A in the same session
- **THEN** change A shows its original ticks and change B shows none the user did not tick there

#### Scenario: Tick state clears after a reload
- **WHEN** the user ticks checklist items and reloads the page
- **THEN** all checklist items are unticked

### Requirement: Checklist never gates or enters the copied prompt

The checklist SHALL NOT affect the review panel's Copy prompt action in any way: the action's enabled state SHALL depend only on the presence of comments, an incomplete checklist SHALL NOT block copying, and the copied prompt SHALL contain only the review comments (with their referenced text and scope) and SHALL NOT include checklist items or tick state.

#### Scenario: Copy works with an incomplete checklist
- **WHEN** the review panel holds at least one comment but some checklist items are unchecked
- **THEN** the Copy prompt action is enabled and copies the comment prompt containing no checklist content

#### Scenario: Empty checklist does not enable copy
- **WHEN** the review panel holds no comments regardless of checklist state
- **THEN** the Copy prompt action stays disabled