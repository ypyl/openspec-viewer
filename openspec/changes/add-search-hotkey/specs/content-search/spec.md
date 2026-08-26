## MODIFIED Requirements

### Requirement: Search box in the app header

The system SHALL present the search input at the top of the app so it is visible and reachable from any state. Two keyboard shortcuts SHALL focus and select the search input — Ctrl+P (Cmd+P on macOS) and Ctrl+K (Cmd+K on macOS) — and pressing Ctrl+P SHALL NOT open the browser's native print dialog. Pressing `Escape` SHALL clear the query and close the results. Queries shorter than three characters SHALL NOT produce results. The sidebar's existing name filter SHALL keep functioning independently of this content search.

#### Scenario: Keyboard shortcut focuses search
- **WHEN** the user presses the search shortcut without typing in any input field
- **THEN** the search input receives focus

#### Scenario: Ctrl+P focuses search without printing
- **WHEN** the user presses Ctrl+P while the browser's print dialog would otherwise open
- **THEN** the print dialog does not open, the search input receives focus, and its current contents are selected

#### Scenario: Ctrl+K still focuses search
- **WHEN** the user presses Ctrl+K
- **THEN** the search input receives focus and its current contents are selected, exactly as before

#### Scenario: Shortcut works from any app state
- **WHEN** the user presses Ctrl+P while an artifact is open in the content pane
- **THEN** the search input receives focus and the artifact stays open

#### Scenario: Escape clears and closes
- **WHEN** the user presses `Escape` while the search input is focused
- **THEN** the query is cleared and the results are closed

#### Scenario: One- or two-character query yields no results
- **WHEN** the query is one or two characters long
- **THEN** no results are shown

#### Scenario: Sidebar filter still works
- **WHEN** the user has an active content search in the header
- **THEN** the sidebar name filter still filters the artifact list by name