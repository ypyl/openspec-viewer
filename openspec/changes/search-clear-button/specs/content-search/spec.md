## MODIFIED Requirements

### Requirement: Search box in the app header

The system SHALL present the search input at the top of the app so it is visible and reachable from any state. Two keyboard shortcuts SHALL focus and select the search input — Ctrl+P (Cmd+P on macOS) and Ctrl+K (Cmd+K on macOS) — and pressing Ctrl+P SHALL NOT open the browser's native print dialog. Pressing `Escape` SHALL clear the query and close the results. The search input SHALL show a visible clear control while it contains text; activating the clear control SHALL clear the query, close the results, remove any transient match highlights, and return focus to the search input, so the user can type a new query immediately. The clear control SHALL NOT be shown when the input is empty. Queries shorter than three characters SHALL NOT produce results. The sidebar's existing name filter SHALL keep functioning independently of this content search.

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

#### Scenario: Clear control appears with a query
- **WHEN** the search input contains at least one character
- **THEN** a visible clear control is shown inside the search input

#### Scenario: Clear control is hidden when empty
- **WHEN** the search input is empty
- **THEN** no clear control is shown

#### Scenario: Clear control resets the search
- **WHEN** the search input contains a query with open results and the user activates the clear control
- **THEN** the query is cleared, the results are closed, any transient match highlights are removed, and focus returns to the search input

#### Scenario: One- or two-character query yields no results
- **WHEN** the query is one or two characters long
- **THEN** no results are shown

#### Scenario: Sidebar filter still works
- **WHEN** the user has an active content search in the header
- **THEN** the sidebar name filter still filters the artifact list by name
